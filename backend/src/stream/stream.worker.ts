import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { queueManager } from "../queue/queue.manager.js";
import { getTrackMetadata } from "../utils/youtube.js";
import { settingsManager } from "../settings/settings.manager.js";
import { streamServer } from "./stream.server.js";

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

  // 4. If still not found, return cwd path
  return cwdPath;
}

const getFallbackAudio = () => resolveDataPath("fallback.mp3");

function getFFmpegCommand(): string {
  if (process.platform === "win32") {
    let execDir = process.execPath;
    if (execDir.includes("node.exe")) {
      execDir = path.dirname(path.dirname(execDir));
    } else {
      execDir = path.dirname(execDir);
    }
    
    const exePath1 = path.join(execDir, "ffmpeg.exe");
    if (fs.existsSync(exePath1)) {
      return exePath1;
    }
    
    const cwdExe = path.join(process.cwd(), "ffmpeg.exe");
    if (fs.existsSync(cwdExe)) {
      return cwdExe;
    }
    
    const parentCwd = path.join(process.cwd(), "..", "ffmpeg.exe");
    if (fs.existsSync(parentCwd)) {
      return parentCwd;
    }
    
    return "ffmpeg";
  }
  return "ffmpeg";
}

function sanitizeForFFmpeg(text: string): string {
  return text.replace(/[':\\\\]/g, " ").trim();
}

// ─── PCM Mixer for Crossfading ───────────────────────────────

class PcmMixer {
  private bufferA: Buffer = Buffer.alloc(0);
  private bufferB: Buffer = Buffer.alloc(0);
  private fadeBytesTotal = 0;
  private fadeBytesMixed = 0;
  private onData: (mixed: Buffer) => void;
  private onComplete: () => void;

  constructor(fadeDuration: number, onData: (mixed: Buffer) => void, onComplete: () => void) {
    this.fadeBytesTotal = Math.max(1, fadeDuration * 176400); // 44100Hz * 2 channels * 2 bytes = 176400 bytes/sec
    this.onData = onData;
    this.onComplete = onComplete;
  }

  public writeA(chunk: Buffer) {
    this.bufferA = Buffer.concat([this.bufferA, chunk]);
    this.process();
  }

  public writeB(chunk: Buffer) {
    this.bufferB = Buffer.concat([this.bufferB, chunk]);
    this.process();
  }

  private process() {
    const available = Math.min(this.bufferA.length, this.bufferB.length);
    if (available === 0) return;

    const remainingFade = this.fadeBytesTotal - this.fadeBytesMixed;
    const toMix = Math.min(available, remainingFade);

    if (toMix > 0) {
      const chunkA = this.bufferA.subarray(0, toMix);
      const chunkB = this.bufferB.subarray(0, toMix);
      const mixed = Buffer.alloc(toMix);

      for (let i = 0; i < toMix; i += 2) {
        if (i + 1 >= toMix) break;
        const valA = chunkA.readInt16LE(i);
        const valB = chunkB.readInt16LE(i);

        // Linear interpolation factor
        const factorB = (this.fadeBytesMixed + i) / this.fadeBytesTotal;
        const factorA = 1 - factorB;

        const mixedVal = Math.round(valA * factorA + valB * factorB);
        const clamped = Math.max(-32768, Math.min(32767, mixedVal));
        mixed.writeInt16LE(clamped, i);
      }

      this.onData(mixed);
      this.fadeBytesMixed += toMix;

      this.bufferA = this.bufferA.subarray(toMix);
      this.bufferB = this.bufferB.subarray(toMix);
    }

    if (this.fadeBytesMixed >= this.fadeBytesTotal) {
      this.onComplete();
    }
  }

  public getRemainingB(): Buffer {
    return this.bufferB;
  }
}

// ─── FFmpeg 2 Helper: Spawns a Decoder Process ─────────────────

function spawnDecoder(
  input: string,
  isLoop: boolean,
  seekSeconds: number,
  duration: number,
  volumeFactor?: string
): ChildProcess {
  const ffmpegCmd = getFFmpegCommand();
  const args: string[] = [];

  if (isLoop) {
    args.push("-stream_loop", "-1");
  }

  if (!isLoop && seekSeconds > 0) {
    args.push("-ss", seekSeconds.toString());
  }

  if (!isLoop && input.startsWith("http")) {
    const isHLS = input.includes(".m3u8");
    if (isHLS) {
      args.push("-protocol_whitelist", "file,http,https,tcp,tls,crypto");
    } else {
      args.push(
        "-reconnect", "1",
        "-reconnect_at_eof", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5"
      );
    }
  }

  // Always read input at real-time speed to prevent backlog buffering in Node/OS pipes
  args.push("-re");
  args.push("-i", input);

  args.push("-f", "s16le", "-ac", "2", "-ar", "44100");

  if (volumeFactor) {
    args.push("-af", `volume=${volumeFactor}`);
  }

  if (!isLoop && duration > 0) {
    args.push("-to", duration.toString());
  }

  args.push("pipe:1");

  console.log(`[ffmpeg decoder] Spawning: ${ffmpegCmd} ${args.join(" ")}`);
  return spawn(ffmpegCmd, args, { stdio: ["ignore", "pipe", "pipe"] });
}

// ─── StreamWorker ────────────────────────────────────────────

class StreamWorker {
  public isRunning = false;
  public isFallback = false;
  public isPaused = false;
  public isSeeking = false;
  public fadeDuration = 3;
  public fallbackVolume = 5;

  public currentTrack: {
    youtubeId: string;
    title: string;
    artist: string;
    duration: number;
    pausedPosition: number;
    startTime: number | null;
    audioUrl?: string;
  } | null = null;

  private encoderProcess: ChildProcess | null = null;
  private decoderProcess: ChildProcess | null = null;
  private preloadProcess: ChildProcess | null = null;

  // Preloaded data cache (FFmpeg 3)
  private nextTrackBuffer: Buffer = Buffer.alloc(0);
  private nextTrackId = "";
  
  // Anti-spam timers
  private preloadTimer: NodeJS.Timeout | null = null;
  private currentTrackPlayTime = 0;
  private currentTrackInterval: NodeJS.Timeout | null = null;
  private activeResolver: (() => void) | null = null;

  // Keep-alive silence generator properties to prevent stream starvation
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private lastWriteTime = 0;

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

  /**
   * Spawns the main mixer and encoder process (FFmpeg 1).
   */
  private launchEncoder(): Promise<void> {
    if (this.encoderProcess) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const settings = settingsManager.getSettings();
      const useCloudflare = settings.useCloudflare;
      const bitrate = useCloudflare ? "128k" : (settings.localBitrate || "320k");
      const ffmpegCmd = getFFmpegCommand();

      const args = [
        "-f", "s16le",
        "-ar", "44100",
        "-ac", "2",
        "-re",
        "-i", "pipe:0",
        "-af", "loudnorm", // Normalization
        "-c:a", "libmp3lame",
        "-b:a", bitrate,
        "-ar", "44100",
        "-f", "mp3",
        "pipe:1"
      ];

      console.log(`[ffmpeg encoder] Spawning: ${ffmpegCmd} ${args.join(" ")}`);

      this.encoderProcess = spawn(ffmpegCmd, args, {
        stdio: ["pipe", "pipe", "pipe"]
      });

      this.encoderProcess.stdin?.on("error", (err: any) => {
        console.warn(`[ffmpeg encoder stdin] Socket error: ${err.message}`);
      });

      // Stream stdout of the encoder to the local streaming HTTP server
      this.encoderProcess.stdout?.on("data", (chunk: Buffer) => {
        streamServer.broadcast(chunk);
      });

      this.encoderProcess.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line.toLowerCase().includes("error")) {
          console.error(`[ffmpeg encoder stderr] ${line}`);
        }
      });

      this.encoderProcess.on("close", (code, signal) => {
        console.log(`[ffmpeg encoder] Closed. Code: ${code}, Signal: ${signal}`);
        this.encoderProcess = null;
        this.stopKeepAlive();
      });

      this.encoderProcess.on("error", (err) => {
        console.error("[ffmpeg encoder] error:", err.message);
        this.encoderProcess = null;
        this.stopKeepAlive();
        reject(err);
      });

      this.lastWriteTime = Date.now();
      this.startKeepAlive();
      resolve();
    });
  }

  private writeToEncoder(chunk: Buffer) {
    this.lastWriteTime = Date.now();
    if (this.encoderProcess && this.encoderProcess.stdin && this.encoderProcess.stdin.writable) {
      this.encoderProcess.stdin.write(chunk);
    }
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (!this.encoderProcess || !this.encoderProcess.stdin || !this.encoderProcess.stdin.writable) {
        return;
      }
      
      const now = Date.now();
      const elapsed = now - this.lastWriteTime;
      
      // If no data has been written for more than 100ms, feed silence bytes to keep stream alive
      if (elapsed >= 100) {
        // 100ms of PCM = 17640 bytes (44100Hz * 2 channels * 2 bytes * 0.1s)
        const silenceBuffer = Buffer.alloc(17640);
        this.encoderProcess.stdin.write(silenceBuffer);
        this.lastWriteTime = now;
      }
    }, 40);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private async playTrackSource(url: string, seekSeconds: number, duration: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.activeResolver = resolve;
      this.currentTrackPlayTime = seekSeconds;
      
      this.startPreloadCheck();

      const hasPreloaded = false; // Disabled to prevent OS pipe buffering delays
      let decoder: ChildProcess;

      if (hasPreloaded) {
        console.log(`[StreamWorker] Using preloaded buffer for track ${this.nextTrackId}`);
        const buffer = this.nextTrackBuffer;
        
        this.nextTrackBuffer = Buffer.alloc(0);
        this.nextTrackId = "";

        // Write the preloaded buffer to the encoder
        this.writeToEncoder(buffer);

        // Spawn decoder seeked to 15 seconds
        decoder = spawnDecoder(url, false, 15, duration);
        this.decoderProcess = decoder;
      } else {
        // Normal decoding from seekSeconds
        decoder = spawnDecoder(url, false, seekSeconds, duration);
        this.decoderProcess = decoder;
      }

      const cleanup = () => {
        decoder.stdout?.removeAllListeners("data");
        decoder.stderr?.removeAllListeners("data");
        decoder.removeAllListeners("close");
        decoder.removeAllListeners("error");
        if (this.decoderProcess === decoder) {
          this.decoderProcess = null;
        }
        this.clearPreloadCheck();
      };

      decoder.stdout?.on("data", (chunk: Buffer) => {
        this.writeToEncoder(chunk);
      });

      decoder.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line.toLowerCase().includes("error")) {
          console.error(`[ffmpeg decoder stderr] ${line}`);
        }
      });

      decoder.on("close", () => {
        cleanup();
        this.activeResolver = null;
        resolve();
      });

      decoder.on("error", (err) => {
        console.error("[ffmpeg decoder] error:", err.message);
        cleanup();
        this.activeResolver = null;
        resolve();
      });
    });
  }

  private runDecoderLoop(input: string, isLoop: boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      this.activeResolver = resolve;
      
      const volumeFactor = (this.fallbackVolume / 100).toFixed(2);
      const decoder = spawnDecoder(input, isLoop, 0, 0, volumeFactor);
      this.decoderProcess = decoder;

      const cleanup = () => {
        decoder.stdout?.removeAllListeners("data");
        decoder.stderr?.removeAllListeners("data");
        decoder.removeAllListeners("close");
        decoder.removeAllListeners("error");
        if (this.decoderProcess === decoder) {
          this.decoderProcess = null;
        }
      };

      decoder.stdout?.on("data", (chunk: Buffer) => {
        this.writeToEncoder(chunk);
      });

      decoder.on("close", () => {
        cleanup();
        this.activeResolver = null;
        resolve();
      });

      decoder.on("error", (err) => {
        console.error("[ffmpeg decoder loop] error:", err.message);
        cleanup();
        this.activeResolver = null;
        resolve();
      });
    });
  }

  // ─── Preloader Logic (FFmpeg 3) ───────────────────────────────

  private startPreloadCheck() {
    this.clearPreloadCheck();
    
    this.currentTrackInterval = setInterval(() => {
      if (this.isPaused || !this.currentTrack) return;
      this.currentTrackPlayTime += 1;
      
      if (this.currentTrackPlayTime >= 15) {
        this.clearPreloadCheck(); // Only trigger once per song
        
        const queue = queueManager.getQueue();
        if (queue.length > 0) {
          const nextTrack = queue[0];
          if (nextTrack && this.nextTrackId !== nextTrack.youtubeId) {
            this.preloadNextTrack(nextTrack.youtubeId);
          }
        }
      }
    }, 1000);
  }

  private clearPreloadCheck() {
    if (this.currentTrackInterval) {
      clearInterval(this.currentTrackInterval);
      this.currentTrackInterval = null;
    }
  }

  private async preloadNextTrack(youtubeId: string) {
    // Completamente deshabilitado para evitar latencia y buffers
    return;
  }

  // ─── Lifecycle & Playback Controls ───────────────────────────

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ StreamWorker already running");
      return;
    }
    this.isRunning = true;
    console.log("🎬 StreamWorker: loop started");

    const settings = settingsManager.getSettings();
    if (settings.streamServerEnabled) {
      await streamServer.start(settings.streamPort);
    }

    await this.launchEncoder();

    // Brief delay to let the encoder initialize
    await new Promise((resolve) => setTimeout(resolve, 800));

    while (this.isRunning) {
      if (!this.encoderProcess) {
        console.log("🔄 Encoder process not active. Restarting encoder...");
        await this.launchEncoder();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const fallbackAudio = getFallbackAudio();

      if (this.isPaused) {
        this.isFallback = true;
        console.log("⏸️ Playback paused — streaming fallback audio");
        this.writeOverlayText("Música en Espera", "Transmisión Pausada");
        await this.runDecoderLoop(fallbackAudio, true);
        continue;
      }

      if (this.currentTrack) {
        this.isFallback = false;
        console.log(`🎵 Playing track: ${this.currentTrack.title}`);
        this.writeOverlayText(this.currentTrack.title, this.currentTrack.artist);

        try {
          let audioUrl = this.currentTrack.audioUrl;
          if (!audioUrl) {
            const metadata = await getTrackMetadata(this.currentTrack.youtubeId);
            audioUrl = metadata.url;
            this.currentTrack.audioUrl = audioUrl;
            this.currentTrack.title = metadata.title;
            this.currentTrack.artist = metadata.artist;
            this.currentTrack.duration = metadata.duration;
          }

          this.currentTrack.startTime = Date.now();
          this.writeOverlayText(this.currentTrack.title, this.currentTrack.artist);

          await this.playTrackSource(audioUrl, this.currentTrack.pausedPosition, this.currentTrack.duration);

          if (!this.isSeeking && !this.isPaused && this.currentTrack && this.currentTrack.startTime !== null) {
            console.log(`✅ Finished playing: ${this.currentTrack.title}`);
            queueManager.addToHistory(this.currentTrack.youtubeId);
            this.currentTrack = null;
          }
          this.isSeeking = false;
        } catch (err) {
          console.error("❌ Error playing current track:", err);
          if (this.currentTrack) {
            queueManager.addFailedNotification(
              this.currentTrack.youtubeId,
              this.currentTrack.title || "Canción en reproducción"
            );
          }
          this.currentTrack = null;
        }
      } else {
        const item = queueManager.next();
        if (item) {
          this.currentTrack = {
            youtubeId: item.youtubeId,
            title: item.title || "Cargando...",
            artist: item.artist || "Cargando...",
            duration: item.duration || 0,
            pausedPosition: 0,
            startTime: Date.now(),
            audioUrl: item.audioUrl
          };
        } else {
          this.isFallback = true;
          console.log("🔁 Queue empty — streaming fallback audio");
          this.writeOverlayText("Música en Espera", "Cola de reproducción vacía");
          await this.runDecoderLoop(fallbackAudio, true);
        }
      }
    }

    console.log("🛑 StreamWorker: loop stopped");
  }

  public async resolveAndPlay(youtubeId: string): Promise<void> {
    try {
      console.log(`[StreamWorker] Resolving track ${youtubeId} immediately...`);
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

      this.isPaused = false;
      this.isFallback = false;

      // Kill the current decoder loop (which is fallback or whatever is playing)
      this.interruptDecoder();
    } catch (err) {
      console.error("[StreamWorker] Failed to resolve and play track:", err);
      queueManager.addFailedNotification(youtubeId, "Resolución de reproducción inmediata");
      this.skip();
    }
  }

  private interruptDecoder(): void {
    if (this.decoderProcess) {
      const proc = this.decoderProcess;
      this.decoderProcess = null;
      
      proc.stdout?.removeAllListeners("data");
      proc.stderr?.removeAllListeners("data");
      proc.removeAllListeners("close");
      proc.removeAllListeners("error");
      
      try {
        proc.kill("SIGKILL");
      } catch (err) {
        console.warn("[StreamWorker] Failed to kill decoder process:", err);
      }
    }

    if (this.activeResolver) {
      const resolve = this.activeResolver;
      this.activeResolver = null;
      resolve();
    }
  }

  public playQueueItem(uuid: string): boolean {
    const item = queueManager.getQueue().find((q) => q.uuid === uuid);
    if (!item) {
      return false;
    }

    // Add current track to history if it exists
    if (this.currentTrack) {
      queueManager.addToHistory(this.currentTrack.youtubeId);
    }

    // Remove from queue
    queueManager.remove(uuid);

    // Set as current track
    this.currentTrack = {
      youtubeId: item.youtubeId,
      title: item.title || "Cargando...",
      artist: item.artist || "Cargando...",
      duration: item.duration || 0,
      pausedPosition: 0,
      startTime: Date.now(),
      audioUrl: item.audioUrl
    };

    this.isPaused = false;
    this.isFallback = false;

    // Interrupt current playback
    this.interruptDecoder();

    return true;
  }

  public pause(): void {
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

    this.interruptDecoder();
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused || !this.currentTrack) {
      return;
    }

    this.isPaused = false;
    console.log(`▶️  Resuming track ${this.currentTrack.youtubeId}`);

    this.interruptDecoder();
  }

  public skip(ignoreHistory = false): void {
    console.log("⏭️  Skipping current track");
    if (this.currentTrack && !ignoreHistory) {
      queueManager.addToHistory(this.currentTrack.youtubeId);
    }
    this.isPaused = false;

    this.clearPreloadCheck();

    const nextItem = queueManager.getQueue()[0];
    const hasPreload = false; // Disabled to prevent OS pipe buffering delays

    if (hasPreload && this.decoderProcess && this.fadeDuration > 0) {
      console.log(`[StreamWorker] Performing crossfade skip to ${nextItem?.youtubeId}...`);
      
      const oldDecoder = this.decoderProcess;
      oldDecoder.stdout?.removeAllListeners("data");

      const item = queueManager.next();
      if (!item) {
        this.currentTrack = null;
        oldDecoder.kill("SIGKILL");
        if (this.activeResolver) this.activeResolver();
        return;
      }

      this.currentTrack = {
        youtubeId: item.youtubeId,
        title: item.title || "Cargando...",
        artist: item.artist || "Cargando...",
        duration: item.duration || 0,
        pausedPosition: 0,
        startTime: Date.now(),
        audioUrl: item.audioUrl
      };
      
      this.writeOverlayText(this.currentTrack.title, this.currentTrack.artist);

      let isMixed = false;
      const mixer = new PcmMixer(this.fadeDuration, (mixedChunk) => {
        this.writeToEncoder(mixedChunk);
      }, () => {
        if (isMixed) return;
        isMixed = true;
        console.log("[StreamWorker] Crossfade skip complete");
        
        oldDecoder.kill("SIGKILL");

        const remaining = mixer.getRemainingB();
        if (remaining.length > 0) {
          this.writeToEncoder(remaining);
        }

        if (this.currentTrack && this.currentTrack.audioUrl) {
          const newDecoder = spawnDecoder(this.currentTrack.audioUrl, false, 15, this.currentTrack.duration);
          this.decoderProcess = newDecoder;

          newDecoder.stdout?.on("data", (chunk: Buffer) => {
            this.writeToEncoder(chunk);
          });

          newDecoder.on("close", () => {
            this.decoderProcess = null;
            if (this.activeResolver) this.activeResolver();
          });
        } else {
          if (this.activeResolver) this.activeResolver();
        }
      });

      mixer.writeB(this.nextTrackBuffer);
      this.nextTrackBuffer = Buffer.alloc(0);
      this.nextTrackId = "";

      oldDecoder.stdout?.on("data", (chunk: Buffer) => {
        mixer.writeA(chunk);
      });

      oldDecoder.on("close", () => {
        if (!isMixed) {
          isMixed = true;
          console.log("[StreamWorker] Old decoder closed during crossfade, completing early");
          const remaining = mixer.getRemainingB();
          if (remaining.length > 0) {
            this.writeToEncoder(remaining);
          }
          if (this.currentTrack && this.currentTrack.audioUrl) {
            const newDecoder = spawnDecoder(this.currentTrack.audioUrl, false, 15, this.currentTrack.duration);
            this.decoderProcess = newDecoder;
            newDecoder.stdout?.on("data", (chunk: Buffer) => {
              this.writeToEncoder(chunk);
            });
            newDecoder.on("close", () => {
              this.decoderProcess = null;
              if (this.activeResolver) this.activeResolver();
            });
          } else {
            if (this.activeResolver) this.activeResolver();
          }
        }
      });
    } else {
      // Normal immediate skip without crossfade
      this.currentTrack = null;
      this.nextTrackBuffer = Buffer.alloc(0);
      this.nextTrackId = "";
      this.interruptDecoder();
    }
  }

  public seek(seconds: number): void {
    if (!this.isRunning || !this.currentTrack) {
      return;
    }

    const targetSeconds = Math.max(0, Math.min(seconds, this.currentTrack.duration));
    console.log(`⏩ Seeking track ${this.currentTrack.youtubeId} to ${targetSeconds.toFixed(1)}s`);
    
    this.isSeeking = true;
    this.currentTrack.pausedPosition = targetSeconds;

    this.interruptDecoder();
  }

  public stop(): void {
    this.isRunning = false;
    this.clearPreloadCheck();
    
    this.interruptDecoder();
    if (this.preloadProcess) {
      this.preloadProcess.kill("SIGKILL");
      this.preloadProcess = null;
    }
    if (this.encoderProcess) {
      this.encoderProcess.kill("SIGKILL");
      this.encoderProcess = null;
      this.stopKeepAlive();
    }

    // Stop native streaming server
    streamServer.stop();

    this.isPaused = false;
    this.currentTrack = null;
    this.nextTrackBuffer = Buffer.alloc(0);
    this.nextTrackId = "";
  }

  public restartEncoder(): void {
    console.log("🔄 Settings changed. Restarting encoder...");
    if (this.encoderProcess) {
      this.encoderProcess.kill("SIGKILL");
    }
  }
}

export const streamWorker = new StreamWorker();
