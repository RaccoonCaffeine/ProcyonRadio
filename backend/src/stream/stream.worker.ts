import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { queueManager } from "../queue/queue.manager.js";
import { getTrackMetadata } from "../utils/youtube.js";
import { settingsManager } from "../settings/settings.manager.js";

// ─── Path Resolvers for Portability ──────────────────────────

function resolveDataPath(fileName: string): string {
  // 1. Try current working directory first
  const cwdPath = path.join(process.cwd(), "data", fileName);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }

  // 2. Try relative to executable (for pkg)
  try {
    const exeDir = path.dirname(process.execPath);
    const exePath = path.join(exeDir, "data", fileName);
    if (fs.existsSync(exePath)) {
      return exePath;
    }
  } catch {}

  // 3. Try one level up from cwd (for ProcyonRadio folder structure)
  const parentPath = path.join(process.cwd(), "..", "data", fileName);
  if (fs.existsSync(parentPath)) {
    return parentPath;
  }

  // 4. If still not found, return cwd path (will be created if needed)
  return cwdPath;
}

const getBackgroundImage = () => resolveDataPath("fondo.jpg");
const getFallbackAudio = () => resolveDataPath("fallback.mp3");

function getFFmpegCommand(): string {
  if (process.platform === "win32") {
    // En pkg, process.execPath apunta al ejecutable de Node dentro del snapshot
    // Necesitamos buscar ffmpeg.exe en el mismo directorio del .exe principal
    
    // 1. Obtener el directorio del ejecutable pkg (ProcyonRadio.exe)
    let execDir = process.execPath;
    if (execDir.includes("node.exe")) {
      // Si está en el snapshot, buscar padre
      execDir = path.dirname(path.dirname(execDir));
    } else {
      execDir = path.dirname(execDir);
    }
    
    const exePath1 = path.join(execDir, "ffmpeg.exe");
    if (fs.existsSync(exePath1)) {
      console.log(`[ffmpeg] Found at: ${exePath1}`);
      return exePath1;
    }
    
    // 2. Try in current working directory
    const cwdExe = path.join(process.cwd(), "ffmpeg.exe");
    if (fs.existsSync(cwdExe)) {
      console.log(`[ffmpeg] Found at: ${cwdExe}`);
      return cwdExe;
    }
    
    // 3. Try one level up from cwd
    const parentCwd = path.join(process.cwd(), "..", "ffmpeg.exe");
    if (fs.existsSync(parentCwd)) {
      console.log(`[ffmpeg] Found at: ${parentCwd}`);
      return parentCwd;
    }
    
    // Fall back to system PATH
    console.log("[ffmpeg] Not found locally, using system PATH (ffmpeg must be installed)");
    return "ffmpeg";
  }
  return "ffmpeg";
}

function resolveFontPath(bold = true): string {
  const fontName = bold ? "DejaVuSans-Bold.ttf" : "DejaVuSans.ttf";
  const localFont = path.join(process.cwd(), "data", fontName);
  
  if (fs.existsSync(localFont)) {
    return localFont.replace(/\\/g, "/").replace(/:/g, "\\:");
  }

  if (process.platform === "win32") {
    const winFont = bold ? "C:/Windows/Fonts/arialbd.ttf" : "C:/Windows/Fonts/arial.ttf";
    if (fs.existsSync(winFont)) {
      return winFont.replace(/:/g, "\\:");
    }
  }

  return bold 
    ? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
}

function sanitizeForFFmpeg(text: string): string {
  return text.replace(/[':\\\\]/g, " ").trim();
}

// ─── StreamWorker ────────────────────────────────────────────
class StreamWorker {
  public isRunning = false;
  private encoderProcess: ChildProcess | null = null;
  private decoderProcess: ChildProcess | null = null;

  public isFallback = false;
  private lastEncoderLaunchTime = 0;

  public currentTrack: {
    youtubeId: string;
    title: string;
    artist: string;
    duration: number; 
    pausedPosition: number; 
    startTime: number | null; 
    audioUrl?: string; 
  } | null = null;

  public isPaused = false;
  public isSeeking = false;
  public fadeDuration = 3;

  /** Writes the current track information to text files to dynamically reload drawtext overlays. */
  private writeOverlayText(title: string, artist: string): void {
    try {
      const titlePath = path.join(process.cwd(), "data", "current_title.txt");
      const artistPath = path.join(process.cwd(), "data", "current_artist.txt");
      
      const dir = path.dirname(titlePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(titlePath, sanitizeForFFmpeg(title), "utf-8");
      fs.writeFileSync(artistPath, sanitizeForFFmpeg(artist), "utf-8");
    } catch (err) {
      console.error("[StreamWorker] Failed to write overlay text files:", err);
    }
  }

  private launchEncoder(): Promise<void> {
    if (this.encoderProcess) return Promise.resolve();
    this.lastEncoderLaunchTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const settings = settingsManager.getSettings();
      const outputMode = settings.outputMode;

      // Validate required settings to prevent launching broken ffmpeg commands
      if (outputMode === "youtube") {
        const streamKey = settings.youtube.streamKey ? settings.youtube.streamKey.trim() : "";
        if (!streamKey) {
          console.warn("⚠️ [StreamWorker] La clave de transmisión de YouTube (Stream Key) está vacía. Configure su clave de transmisión en el panel de Ajustes.");
          this.encoderProcess = null;
          resolve();
          return;
        }
      } else {
        const serverUrl = settings.icecast.serverUrl ? settings.icecast.serverUrl.trim() : "";
        if (!serverUrl) {
          console.warn("⚠️ [StreamWorker] La URL del servidor Icecast está vacía. Configure su Server URL en el panel de Ajustes.");
          this.encoderProcess = null;
          resolve();
          return;
        }
      }

      const ffmpegCmd = getFFmpegCommand();
      const args: string[] = [];

      // Ensure text files exist
      this.writeOverlayText("Música en Espera", "Iniciando...");

      const titlePath = path.join(process.cwd(), "data", "current_title.txt");
      const artistPath = path.join(process.cwd(), "data", "current_artist.txt");

      if (outputMode === "youtube") {
        // ── YOUTUBE MODE (Persistent Video + Audio RTMP) ─────────────
        const rtmpUrl = `${settings.youtube.rtmpUrl}/${settings.youtube.streamKey}`;
        const backgroundImage = getBackgroundImage();

        args.push(
          "-re",
          "-loop", "1",
          "-i", backgroundImage,
          "-f", "s16le",
          "-ar", "44100",
          "-ac", "2",
          "-i", "pipe:0" // Read PCM raw audio from stdin
        );

        const titleFont = resolveFontPath(true);
        const artistFont = resolveFontPath(false);

        // Configure drawtext with textfile and reload=1 for dynamic updates
        const drawTitle = `drawtext=fontfile='${titleFont}':textfile='${titlePath.replace(/\\/g, "/").replace(/:/g, "\\:")}':reload=1:fontsize=13:fontcolor=white:x=w-tw-20:y=h-th-35`;
        const drawArtist = `drawtext=fontfile='${artistFont}':textfile='${artistPath.replace(/\\/g, "/").replace(/:/g, "\\:")}':reload=1:fontsize=9:fontcolor=gray:x=w-tw-20:y=h-th-15`;
        const videoFilter = `scale=640:360,${drawTitle},${drawArtist}`;

        args.push(
          "-vf", videoFilter,
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-b:v", "600k",
          "-maxrate", "600k",
          "-bufsize", "1200k",
          "-pix_fmt", "yuv420p",
          "-g", "60",
          "-c:a", "aac",
          "-b:a", "128k",
          "-ar", "44100",
          "-f", "flv",
          rtmpUrl
        );
      } else {
        // ── ICECAST MODE (Persistent Audio Only) ─────────────────────
        const serverUrl = settings.icecast.serverUrl;
        const format = settings.icecast.format;
        const bitrate = settings.icecast.bitrate;

        args.push(
          "-re",
          "-f", "s16le",
          "-ar", "44100",
          "-ac", "2",
          "-i", "pipe:0"
        );

        if (format === "mp3") {
          args.push(
            "-c:a", "libmp3lame",
            "-b:a", bitrate,
            "-ar", "44100",
            "-content_type", "audio/mpeg",
            "-f", "mp3"
          );
        } else {
          args.push(
            "-c:a", "aac",
            "-b:a", bitrate,
            "-ar", "44100",
            "-content_type", "audio/aac",
            "-f", "adts"
          );
        }

        let finalUrl = serverUrl;
        if (serverUrl.startsWith("shoutcast://")) {
          finalUrl = serverUrl.replace("shoutcast://", "icecast://");
          const urlObj = finalUrl.split("@");
          if (urlObj.length > 1) {
            const hostPortPart = urlObj[urlObj.length - 1];
            if (hostPortPart && !hostPortPart.includes("/")) {
              finalUrl = finalUrl + "/stream";
            }
          }
          args.push("-legacy_icecast", "1");
        }

        args.push(finalUrl);
      }

      console.log(`[ffmpeg encoder] Spawning: ${ffmpegCmd} ${args.join(" ")}`);

      this.encoderProcess = spawn(ffmpegCmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.encoderProcess.stdin?.on("error", (err: any) => {
        console.warn(`[ffmpeg encoder stdin] Socket error: ${err.message}`);
      });

      this.encoderProcess.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line.toLowerCase().includes("error")) {
          console.error(`[ffmpeg encoder stderr] ${line}`);
        }
      });

      this.encoderProcess.on("close", (code, signal) => {
        if (signal) {
          console.log(`[ffmpeg encoder] Terminado deliberadamente por señal: ${signal}`);
        } else {
          console.log(`[ffmpeg encoder] Finalizado con código de salida: ${code}`);
        }
        this.encoderProcess = null;
        resolve();
      });

      this.encoderProcess.on("error", (err) => {
        console.error("[ffmpeg encoder] Spawn error:", err.message);
        this.encoderProcess = null;
        reject(err);
      });
    });
  }

  /** Spawns a lightweight decoder for a single track and pipes raw PCM output to the encoder. */
  private runDecoder(
    audioInput: string,
    isFallback: boolean,
    seekSeconds = 0,
    duration = 0
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const ffmpegCmd = getFFmpegCommand();
      const args: string[] = [];

      if (isFallback) {
        args.push("-stream_loop", "-1");
      }

      if (!isFallback && seekSeconds > 0) {
        args.push("-ss", seekSeconds.toString());
      }

      if (!isFallback && audioInput.startsWith("http")) {
        const isHLS = audioInput.includes(".m3u8");
        if (isHLS) {
          // HLS playlists manage segment fetching internally;
          // reconnect flags interfere with normal segment transitions.
          args.push(
            "-protocol_whitelist", "file,http,https,tcp,tls,crypto"
          );
        } else {
          args.push(
            "-reconnect", "1",
            "-reconnect_at_eof", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "5"
          );
        }
      }

      args.push(
        "-i", audioInput,
        "-f", "s16le",
        "-ac", "2",
        "-ar", "44100"
      );

      // Apply audio crossfade duration if configured
      if (!isFallback && duration > 0 && this.fadeDuration > 0) {
        const fade = Math.min(this.fadeDuration, duration / 2);
        if (fade > 0) {
          args.push("-af", `afade=t=in:ss=0:d=${fade.toFixed(1)},afade=t=out:st=${(duration - fade).toFixed(1)}:d=${fade.toFixed(1)}`);
        }
      }

      if (!isFallback && duration > 0) {
        args.push("-to", duration.toString());
      }

      // Output raw PCM on stdout
      args.push("pipe:1");

      console.log(`[ffmpeg decoder] Spawning: ${ffmpegCmd} ${args.join(" ")}`);

      this.decoderProcess = spawn(ffmpegCmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Stream piping directly to the active encoder stdin
      if (this.encoderProcess && this.encoderProcess.stdin) {
        this.decoderProcess.stdout?.on("error", (err: any) => {
          console.warn(`[ffmpeg decoder stdout] Socket error: ${err.message}`);
        });
        this.decoderProcess.stdout?.pipe(this.encoderProcess.stdin, { end: false });
      }

      this.decoderProcess.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line.toLowerCase().includes("error")) {
          console.error(`[ffmpeg decoder stderr] ${line}`);
        }
      });

      this.decoderProcess.on("close", (code, signal) => {
        if (signal) {
          console.log(`[ffmpeg decoder] Terminado deliberadamente por señal (interrupción de reproducción): ${signal}`);
        } else {
          console.log(`[ffmpeg decoder] Finalizado con código de salida: ${code}`);
        }
        this.decoderProcess = null;
        resolve();
      });

      this.decoderProcess.on("error", (err) => {
        console.error("[ffmpeg decoder] Spawn error:", err.message);
        this.decoderProcess = null;
        resolve();
      });
    });
  }

  /** Main stream worker execution loop. */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ StreamWorker already running");
      return;
    }
    this.isRunning = true;
    console.log("🎬 StreamWorker: loop started");

    // Launch encoder
    this.launchEncoder().catch((err) => {
      console.error("❌ Failed to start ffmpeg encoder:", err);
      this.isRunning = false;
    });

    // Brief delay to allow encoder process to spawn
    await new Promise((resolve) => setTimeout(resolve, 800));

    while (this.isRunning) {
      if (!this.encoderProcess) {
        const elapsed = Date.now() - this.lastEncoderLaunchTime;
        const delay = Math.max(5000 - elapsed, 1000); // Wait at least 5 seconds between launches
        console.log(`🔄 Encoder process not active. Restarting encoder in ${Math.round(delay / 1000)}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (!this.isRunning) break;
        await this.launchEncoder();
        continue;
      }

      const fallbackAudio = getFallbackAudio();

      if (this.isPaused) {
        this.isFallback = true;
        console.log("⏸️ Playback paused — streaming fallback audio");
        this.writeOverlayText("Música en Espera", "Transmisión Pausada");
        await this.runDecoder(fallbackAudio, true);
        continue;
      }

      if (this.currentTrack) {
        this.isFallback = false;
        console.log(`🎵 Playing (resuming): ${this.currentTrack.title} (${this.currentTrack.youtubeId}) at ${this.currentTrack.pausedPosition.toFixed(1)}s`);
        this.writeOverlayText(this.currentTrack.title, this.currentTrack.artist);

        try {
          let audioUrl = this.currentTrack.audioUrl;
          if (!audioUrl) {
            const metadata = await getTrackMetadata(this.currentTrack.youtubeId);
            if (!this.currentTrack) continue;
            audioUrl = metadata.url;
            this.currentTrack.audioUrl = audioUrl;
            this.currentTrack.title = metadata.title;
            this.currentTrack.artist = metadata.artist;
            this.currentTrack.duration = metadata.duration;
          }
          
          if (!this.currentTrack) continue;
          this.currentTrack.startTime = Date.now();
          this.writeOverlayText(this.currentTrack.title, this.currentTrack.artist);

          await this.runDecoder(
            audioUrl!,
            false,
            this.currentTrack.pausedPosition,
            this.currentTrack.duration
          );

          if (this.isSeeking) {
            this.isSeeking = false;
          } else if (!this.isPaused && this.currentTrack && this.currentTrack.startTime !== null) {
            console.log(`✅ Finished playing: ${this.currentTrack.title}`);
            queueManager.addToHistory(this.currentTrack.youtubeId);
            this.currentTrack = null;
          }
        } catch (err) {
          console.error(`❌ Error playing current track ${this.currentTrack?.youtubeId}:`, err);
          this.currentTrack = null;
        }
      } else {
        const item = queueManager.next();

        if (item) {
          this.isFallback = false;
          console.log(`🎵 Dequeued new track: ${item.youtubeId}`);
          try {
            if (item.audioUrl && item.duration) {
              this.currentTrack = {
                youtubeId: item.youtubeId,
                title: item.title || "Unknown Title",
                artist: item.artist || "Unknown Artist",
                duration: item.duration,
                pausedPosition: 0,
                startTime: Date.now(),
                audioUrl: item.audioUrl
              };
            } else {
              this.currentTrack = {
                youtubeId: item.youtubeId,
                title: item.title || "Cargando...",
                artist: item.artist || "Cargando...",
                duration: 0,
                pausedPosition: 0,
                startTime: Date.now()
              };

              const metadata = await getTrackMetadata(item.youtubeId);
              if (!this.currentTrack) continue;
              this.currentTrack.audioUrl = metadata.url;
              this.currentTrack.title = metadata.title;
              this.currentTrack.artist = metadata.artist;
              this.currentTrack.duration = metadata.duration;
            }

            if (!this.currentTrack) continue;
            this.currentTrack.startTime = Date.now();
            this.writeOverlayText(this.currentTrack.title, this.currentTrack.artist);

            await this.runDecoder(
              this.currentTrack.audioUrl!,
              false,
              0,
              this.currentTrack.duration
            );

            if (this.isSeeking) {
              this.isSeeking = false;
            } else if (!this.isPaused && this.currentTrack && this.currentTrack.startTime !== null) {
              console.log(`✅ Finished playing: ${this.currentTrack.title}`);
              queueManager.addToHistory(this.currentTrack.youtubeId);
              this.currentTrack = null;
            }
          } catch (err) {
            console.error(`❌ Error playing dequeued track ${item.youtubeId}:`, err);
            this.currentTrack = null;
          }
        } else {
          this.isFallback = true;
          console.log("🔁 Queue empty — streaming fallback audio");
          this.writeOverlayText("Música en Espera", "Cola de reproducción vacía");
          await this.runDecoder(fallbackAudio, true);
        }
      }
    }

    console.log("🛑 StreamWorker: loop stopped");
  }

  /** Pre-resolves metadata and stops current fallback decoder so the track starts immediately. */
  async resolveAndPlay(youtubeId: string): Promise<void> {
    try {
      console.log(`[StreamWorker] Pre-resolving ${youtubeId} while fallback is active...`);
      const metadata = await getTrackMetadata(youtubeId);
      
      this.currentTrack = {
        youtubeId,
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.duration,
        pausedPosition: 0,
        startTime: Date.now(),
        audioUrl: metadata.url
      };
      
      if (this.decoderProcess) {
        this.decoderProcess.kill("SIGKILL");
      }
    } catch (err) {
      console.error(`[StreamWorker] Failed to pre-resolve ${youtubeId}:`, err);
      this.skip();
    }
  }

  /** Pauses the current playing track. */
  pause(): void {
    if (!this.isRunning || this.isPaused || !this.currentTrack) {
      return;
    }

    if (this.currentTrack.startTime !== null) {
      const elapsed = (Date.now() - this.currentTrack.startTime) / 1000;
      this.currentTrack.pausedPosition += elapsed;
      this.currentTrack.startTime = null;
    }

    this.isPaused = true;
    console.log(`⏸️  Pausing current track at ${this.currentTrack.pausedPosition.toFixed(1)}s`);

    if (this.decoderProcess) {
      this.decoderProcess.kill("SIGKILL");
    }
  }

  /** Resumes the paused track. */
  resume(): void {
    if (!this.isRunning || !this.isPaused || !this.currentTrack) {
      return;
    }

    this.isPaused = false;
    console.log(`▶️  Resuming track ${this.currentTrack.youtubeId}`);

    if (this.decoderProcess) {
      this.decoderProcess.kill("SIGKILL");
    }
  }

  /** Immediately skips the current track. */
  skip(ignoreHistory = false): void {
    console.log("⏭️  Skipping current track");
    if (this.currentTrack && !ignoreHistory) {
      queueManager.addToHistory(this.currentTrack.youtubeId);
    }
    this.isPaused = false;
    this.currentTrack = null;

    if (this.decoderProcess) {
      this.decoderProcess.kill("SIGKILL");
    }
  }

  /** Seeks to a timestamp in the current track. */
  seek(seconds: number): void {
    if (!this.isRunning || !this.currentTrack) {
      return;
    }

    const targetSeconds = Math.max(0, Math.min(seconds, this.currentTrack.duration));
    console.log(`⏩ Seeking track ${this.currentTrack.youtubeId} to ${targetSeconds.toFixed(1)}s`);
    
    this.isSeeking = true;
    this.currentTrack.pausedPosition = targetSeconds;

    if (this.decoderProcess) {
      this.decoderProcess.kill("SIGKILL");
    }
  }

  /** Stops the streaming loop and terminates all FFmpeg processes. */
  stop(): void {
    this.isRunning = false;
    
    if (this.decoderProcess) {
      this.decoderProcess.kill("SIGKILL");
      this.decoderProcess = null;
    }
    if (this.encoderProcess) {
      this.encoderProcess.kill("SIGKILL");
      this.encoderProcess = null;
    }

    this.isPaused = false;
    this.currentTrack = null;
  }

  /** Restarts the encoder process to apply settings changes immediately. */
  restartEncoder(): void {
    console.log("🔄 Settings changed. Restarting encoder...");
    if (this.encoderProcess) {
      this.encoderProcess.kill("SIGKILL");
    }
  }
}

export const streamWorker = new StreamWorker();
