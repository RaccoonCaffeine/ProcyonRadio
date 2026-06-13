import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import http from "node:http";
import https from "node:https";

import { queueManager } from "./queue/queue.manager.js";
import { extractYoutubeIds, searchTracks } from "./utils/youtube.js";
import { streamWorker } from "./stream/stream.worker.js";
import { settingsManager } from "./settings/settings.manager.js";
import { authManager, type UserRole } from "./auth/auth.manager.js";
import { tunnelManager } from "./utils/tunnel.manager.js";
import { isActivated, activateLicense, initializeLicenseCheck } from "./utils/license.js";

// ─── Express app ─────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' folder (embedded in pkg snapshot or local directory)
const publicPath = (process as any).pkg
  ? path.join(__dirname, "../public")
  : path.join(process.cwd(), "public");

// ─── License Verification Middleware ───────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const isStaticFile = req.path.includes(".") && !req.path.endsWith(".html");
  const isActivateRoute = req.path === "/activate" || req.path === "/activate.html" || req.path === "/api/activate";
  
  if (isActivated || isActivateRoute || isStaticFile) {
    next();
  } else {
    res.redirect("/activate");
  }
});

app.get("/activate", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, "activate.html"));
});

app.post("/api/activate", async (req: Request, res: Response) => {
  try {
    const { key } = req.body as { key?: string };
    if (!key) {
      res.status(400).json({ error: "Falta la clave de activación." });
      return;
    }
    const result = await activateLicense(key.trim());
    if (result.success) {
      if (streamWorker) {
        streamWorker.start().catch((err) => {
          console.error("❌ Error starting stream on activation:", err);
        });
      }
      const currentSettings = settingsManager.getSettings();
      if (currentSettings.exposeServer) {
        tunnelManager.start(currentSettings.port).catch((err) => {
          console.error("❌ Error starting tunnel on activation:", err);
        });
      }
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.use(express.static(publicPath));

// ─── Auth Middlewares ─────────────────────────────────────────

/** Checks for a valid Bearer token and attaches user information to Request. */
const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    next();
    return;
  }

  const session = authManager.getSession(token);
  if (session) {
    (req as any).user = {
      username: session.username,
      role: session.role,
    };
  }
  next();
};

app.use(authMiddleware);

/** Restricts route to specific user roles. */
const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Autenticación requerida." });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Acceso denegado. Privilegios insuficientes." });
      return;
    }
    next();
  };
};

/** Validates addition access based on settings. */
const allowGuestOrOperator = (req: Request, res: Response, next: NextFunction) => {
  const settings = settingsManager.getSettings();
  if (settings.allowGuestAdd) {
    next();
    return;
  }

  const user = (req as any).user;
  if (!user || !["owner", "admin", "operator"].includes(user.role)) {
    res.status(401).json({ error: "Autenticación requerida para agregar canciones." });
    return;
  }
  next();
};

// ─── Auth Routes ──────────────────────────────────────────────

/** Setup status — checks if initial Owner has registered. */
app.get("/api/auth/setup-status", (_req: Request, res: Response) => {
  res.json({ isSetup: authManager.isSetupComplete() });
});

/** Setup Owner account — only works if no owner is registered. */
app.post("/api/auth/setup", (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: "Faltan usuario o contraseña." });
      return;
    }
    const owner = authManager.registerOwner(username, password);
    res.json({ success: true, username: owner.username, role: owner.role });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Login endpoint. */
app.post("/api/auth/login", (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: "Faltan usuario o contraseña." });
      return;
    }
    const session = authManager.login(username, password);
    res.json({ token: session.token, username: session.username, role: session.role });
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Logout endpoint. */
app.post("/api/auth/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    authManager.logout(token);
  }
  res.json({ success: true });
});

/** Return logged in user profile. */
app.get("/api/auth/me", (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.json({ user: null });
  } else {
    res.json({ user: { username: user.username, role: user.role } });
  }
});

/** Get all registered users list. Requres admin/owner. */
app.get("/api/auth/users", requireRole(["owner", "admin"]), (_req: Request, res: Response) => {
  res.json({ users: authManager.listUsers() });
});

/** Create user. Requires admin/owner. */
app.post("/api/auth/users/create", requireRole(["owner", "admin"]), (req: Request, res: Response) => {
  try {
    const creator = (req as any).user;
    const { username, password, role } = req.body as { username?: string; password?: string; role?: UserRole };

    if (!username || !password || !role) {
      res.status(400).json({ error: "Faltan campos (username, password, role)." });
      return;
    }

    const user = authManager.createUser(creator.role, username, password, role);
    res.json({ success: true, username: user.username, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Delete user. Requires admin/owner. */
app.delete("/api/auth/users/delete/:username", requireRole(["owner", "admin"]), (req: Request, res: Response) => {
  try {
    const creator = (req as any).user;
    const { username } = req.params;
    if (!username) {
      res.status(400).json({ error: "Falta parámetro 'username'." });
      return;
    }

    authManager.deleteUser(creator.role, creator.username, username);
    res.json({ success: true, message: `Usuario ${username} eliminado.` });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Playback & Queue Routes ─────────────────────────────────

/** Health check — includes fallback status. */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    isFallback: streamWorker.isFallback,
  });
});

/** Returns the comprehensive status of the player and queue. */
app.get("/api/status", (_req: Request, res: Response) => {
  const current = streamWorker.currentTrack;
  let elapsed = 0;
  
  if (current) {
    if (current.startTime !== null) {
      elapsed = current.pausedPosition + (Date.now() - current.startTime) / 1000;
    } else {
      elapsed = current.pausedPosition;
    }
    if (elapsed > current.duration) {
      elapsed = current.duration;
    }
  }

  res.json({
    status: "ok",
    isStreaming: streamWorker.isRunning,
    isFallback: streamWorker.isFallback,
    isPaused: streamWorker.isPaused,
    fadeDuration: streamWorker.fadeDuration,
    outputMode: settingsManager.getSettings().outputMode,
    allowGuestAdd: settingsManager.getSettings().allowGuestAdd,
    exposeServer: settingsManager.getSettings().exposeServer,
    publicUrl: tunnelManager.getPublicUrl(),
    currentTrack: current ? {
      youtubeId: current.youtubeId,
      title: current.title,
      artist: current.artist,
      duration: current.duration,
      elapsed: Math.floor(elapsed),
    } : null,
    queue: queueManager.getQueue(),
    hasHistory: queueManager.getHistory().length > 0,
  });
});

/** Returns the full current queue. */
app.get("/api/queue", (_req: Request, res: Response) => {
  res.json({ queue: queueManager.getQueue() });
});

/** Search YouTube tracks. */
app.get("/api/search", async (req: Request, res: Response) => {
  try {
    const query = req.query["q"];
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Falta el parámetro de búsqueda 'q'." });
      return;
    }
    const results = await searchTracks(query);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: "Error al realizar la búsqueda." });
  }
});

/** Accepts a YouTube URL or direct stream link, and enqueues it. */
app.post("/api/queue/add", allowGuestOrOperator, async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url?: string };

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Enlace inválido o ausente." });
      return;
    }

    const ids = await extractYoutubeIds(url);

    if (ids.length === 0) {
      res.status(400).json({ error: "No se encontraron IDs de video o enlaces de audio compatibles." });
      return;
    }

    for (const id of ids) {
      queueManager.add(id);
    }

    if (streamWorker.isFallback && !streamWorker.isPaused) {
      const item = queueManager.next();
      if (item) {
        streamWorker.resolveAndPlay(item.youtubeId);
      }
    }

    res.json({ added: ids.length, queue: queueManager.getQueue() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/queue/add] Error:", message);
    res.status(500).json({ error: "Error al procesar el enlace." });
  }
});

/** Skips the currently playing track. Requires Operator+ */
app.post("/api/queue/skip", requireRole(["owner", "admin", "operator"]), (_req: Request, res: Response) => {
  streamWorker.skip();
  res.json({ message: "Siguiente canción.", queue: queueManager.getQueue() });
});

/** Pauses the currently playing track. Requires Admin+ */
app.post("/api/queue/pause", requireRole(["owner", "admin"]), (_req: Request, res: Response) => {
  streamWorker.pause();
  res.json({ message: "Transmisión pausada." });
});

/** Resumes playing the paused track. Requires Admin+ */
app.post("/api/queue/resume", requireRole(["owner", "admin"]), (_req: Request, res: Response) => {
  streamWorker.resume();
  res.json({ message: "Transmisión reanudada." });
});

/** Shuffles the queue in-place. Requires Operator+ */
app.post("/api/queue/shuffle", requireRole(["owner", "admin", "operator"]), (_req: Request, res: Response) => {
  queueManager.shuffle();
  res.json({ message: "Cola mezclada.", queue: queueManager.getQueue() });
});

/** Clears the queue. Requires Admin+ */
app.post("/api/queue/clear", requireRole(["owner", "admin"]), (_req: Request, res: Response) => {
  queueManager.clear();
  res.json({ message: "Cola vaciada.", queue: [] });
});

/** Removes a specific item from the queue. Requires Admin+ */
app.delete("/api/queue/remove/:uuid", requireRole(["owner", "admin"]), (req: Request, res: Response) => {
  const { uuid } = req.params;
  if (!uuid) {
    res.status(400).json({ error: "Falta parámetro 'uuid'." });
    return;
  }
  const success = queueManager.remove(uuid);
  if (success) {
    res.json({ message: "Canción removida de la cola.", queue: queueManager.getQueue() });
  } else {
    res.status(404).json({ error: "Canción no encontrada en la cola." });
  }
});

/** Steps back to the previous track. Requires Operator+ */
app.post("/api/queue/back", requireRole(["owner", "admin", "operator"]), (_req: Request, res: Response) => {
  const prevId = queueManager.popHistory();
  if (!prevId) {
    res.status(400).json({ error: "No hay historial disponible." });
    return;
  }

  const current = streamWorker.currentTrack;
  if (current) {
    queueManager.prepend(current.youtubeId);
  }

  queueManager.prepend(prevId);
  streamWorker.skip(true);

  res.json({ message: "Retrocedido a la canción anterior.", queue: queueManager.getQueue() });
});

/** Seeks to a timestamp. Requires Operator+ */
app.post("/api/queue/seek", requireRole(["owner", "admin", "operator"]), (req: Request, res: Response) => {
  const { seconds } = req.body as { seconds?: number };
  if (typeof seconds !== "number") {
    res.status(400).json({ error: "Falta parámetro 'seconds'." });
    return;
  }
  streamWorker.seek(seconds);
  res.json({ message: `Seek a ${seconds}s.` });
});

/** Reorders items (drag and drop). Requires Operator+ */
app.post("/api/queue/reorder", requireRole(["owner", "admin", "operator"]), (req: Request, res: Response) => {
  const { fromIndex, toIndex } = req.body as { fromIndex?: number; toIndex?: number };
  if (typeof fromIndex !== "number" || typeof toIndex !== "number") {
    res.status(400).json({ error: "Parámetros inválidos." });
    return;
  }
  queueManager.reorder(fromIndex, toIndex);
  res.json({ message: "Cola reordenada.", queue: queueManager.getQueue() });
});

// ─── Settings API Routes ──────────────────────────────────────

/** Get current settings. Requires Admin+ */
app.get("/api/settings", requireRole(["owner", "admin"]), (_req: Request, res: Response) => {
  res.json(settingsManager.getSettings());
});

/** Update settings. Requires Admin+ */
app.post("/api/settings", requireRole(["owner", "admin"]), (req: Request, res: Response) => {
  try {
    const newSettings = req.body as any;
    
    // Update local variables in StreamWorker/etc. if needed
    if (typeof newSettings.fadeDuration === "number") {
      streamWorker.fadeDuration = newSettings.fadeDuration;
    }
    
    const oldSettings = settingsManager.getSettings();
    settingsManager.update(newSettings);
    const updatedSettings = settingsManager.getSettings();

    // Manage tunnel lifecycle on settings change
    if (updatedSettings.exposeServer !== oldSettings.exposeServer || updatedSettings.port !== oldSettings.port) {
      if (updatedSettings.exposeServer) {
        tunnelManager.start(updatedSettings.port).catch((err) => {
          console.error("❌ Error starting tunnel:", err);
        });
      } else {
        tunnelManager.stop();
      }
    }

    // Check if streaming settings changed to restart the encoder if it's active
    const streamSettingsChanged = 
      oldSettings.outputMode !== updatedSettings.outputMode ||
      oldSettings.youtube.rtmpUrl !== updatedSettings.youtube.rtmpUrl ||
      oldSettings.youtube.streamKey !== updatedSettings.youtube.streamKey ||
      oldSettings.icecast.serverUrl !== updatedSettings.icecast.serverUrl ||
      oldSettings.icecast.format !== updatedSettings.icecast.format ||
      oldSettings.icecast.bitrate !== updatedSettings.icecast.bitrate;

    if (streamSettingsChanged && streamWorker.isRunning) {
      streamWorker.restartEncoder();
    }
    
    res.json({ success: true, settings: updatedSettings });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Stream Lifecycle API Routes ──────────────────────────────

/** Starts the stream. Requires Admin+ */
app.post("/api/stream/start", requireRole(["owner", "admin"]), (_req: Request, res: Response) => {
  if (streamWorker.isRunning) {
    res.status(400).json({ error: "La transmisión ya está iniciada." });
    return;
  }
  streamWorker.start().catch((err) => {
    console.error("❌ StreamWorker start error:", err);
  });
  res.json({ message: "Transmisión iniciada." });
});

/** Stops the stream. Requires Admin+ */
app.post("/api/stream/stop", requireRole(["owner", "admin"]), (_req: Request, res: Response) => {
  if (!streamWorker.isRunning) {
    res.status(400).json({ error: "La transmisión ya está detenida." });
    return;
  }
  streamWorker.stop();
  res.json({ message: "Transmisión detenida." });
});

/** Public proxy endpoint to bypass HTTPS Mixed Content blocking in browsers/FiveM. */
app.get("/api/stream/proxy", (req: Request, res: Response) => {
  const settings = settingsManager.getSettings();
  if (settings.outputMode !== "icecast") {
    res.status(400).json({ error: "El proxy de transmisión solo está disponible en modo Icecast." });
    return;
  }

  const serverUrl = settings.icecast.serverUrl;
  if (!serverUrl) {
    res.status(404).json({ error: "No hay un servidor de transmisión configurado." });
    return;
  }

  let httpUrl = serverUrl;
  if (serverUrl.startsWith("icecast://")) {
    httpUrl = serverUrl.replace(/^icecast:\/\/(?:[^:]+):[^@]+@/, "http://");
  } else if (serverUrl.startsWith("shoutcast://")) {
    httpUrl = serverUrl.replace(/^shoutcast:\/\/(?:[^:]+):[^@]+@/, "http://");
    if (!httpUrl.includes("/", 7)) {
      httpUrl = httpUrl + "/stream";
    }
  }

  const format = settings.icecast.format || "mp3";
  const contentType = format === "aac" ? "audio/aac" : "audio/mpeg";

  console.log(`[Stream Proxy] Setting up dynamic keep-alive proxy for: ${httpUrl}`);

  // Write headers immediately so the client (FiveM / browser) gets connected
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Connection": "keep-alive"
  });

  let activeRequest: http.ClientRequest | null = null;
  let isClosed = false;

  const connectToSource = () => {
    if (isClosed) return;

    const client = httpUrl.startsWith("https") ? https : http;

    const streamRequest = client.get(httpUrl, (streamResponse) => {
      if (isClosed) {
        streamRequest.destroy();
        return;
      }

      console.log(`[Stream Proxy] Connected to source stream successfully`);

      // Pipe to client but do NOT end the response stream when the source ends
      streamResponse.pipe(res, { end: false });

      streamResponse.on("end", () => {
        console.log(`[Stream Proxy] Source connection ended. Reconnecting in 500ms...`);
        streamRequest.destroy();
        if (!isClosed) {
          setTimeout(connectToSource, 500);
        }
      });

      streamResponse.on("error", (err) => {
        console.error(`[Stream Proxy] Source stream error: ${err.message}. Reconnecting in 500ms...`);
        streamRequest.destroy();
        if (!isClosed) {
          setTimeout(connectToSource, 500);
        }
      });
    });

    activeRequest = streamRequest;

    streamRequest.on("error", (err) => {
      console.error(`[Stream Proxy] Request connection error: ${err.message}. Reconnecting in 1000ms...`);
      streamRequest.destroy();
      if (!isClosed) {
        setTimeout(connectToSource, 1000);
      }
    });
  };

  connectToSource();

  req.on("close", () => {
    console.log("[Stream Proxy] Client connection closed.");
    isClosed = true;
    if (activeRequest) {
      activeRequest.destroy();
    }
    res.end();
  });
});

// ─── Bootstrap ───────────────────────────────────────────────

const settings = settingsManager.getSettings();
const PORT = settings.port;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`📡 ProcyonRadio server listening on :${PORT}`);

  try {
    console.log("🔑 [Licensing] Verificando licencia de activación...");
    const licenseActive = await initializeLicenseCheck();
    
    if (licenseActive) {
      if (streamWorker) {
        streamWorker.fadeDuration = settings.fadeDuration;
        streamWorker.start().catch((err) => {
          console.error("❌ StreamWorker fatal error:", err);
          process.exit(1);
        });
      } else {
        console.error("❌ StreamWorker is not defined");
        process.exit(1);
      }
    } else {
      console.warn("🔑 [Licensing] La aplicación está BLOQUEADA. Ingresa una licencia en la web para iniciar.");
    }
  } catch (err) {
    console.error("❌ Error during server initialization:", err);
    process.exit(1);
  }

  // Start tunnel on boot if enabled (only if activated)
  if (settings.exposeServer && isActivated) {
    tunnelManager.start(PORT).catch((err) => {
      console.error("❌ Error starting tunnel on boot:", err);
    });
  }
});

// Handle clean shutdown
const shutdown = () => {
  console.log("👋 Shutting down ProcyonRadio server...");
  tunnelManager.stop();
  streamWorker.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
