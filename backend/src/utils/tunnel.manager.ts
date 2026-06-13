import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

class TunnelManager {
  private process: ChildProcess | null = null;
  private publicUrl: string = "";
  private isStarting: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private port: number = 3000;
  private targetExpose: boolean = false;

  getPublicUrl(): string {
    return this.publicUrl;
  }

  isActive(): boolean {
    return this.process !== null;
  }

  async start(port: number): Promise<string> {
    this.port = port;
    this.targetExpose = true;
    
    if (this.process) {
      return this.publicUrl;
    }

    if (this.isStarting) {
      // If already starting, wait for it to finish and return the URL
      return new Promise((resolve) => {
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (this.publicUrl) {
            clearInterval(interval);
            resolve(this.publicUrl);
          } else if (checks >= 30 || !this.isStarting) {
            clearInterval(interval);
            resolve("");
          }
        }, 500);
      });
    }

    this.isStarting = true;
    this.publicUrl = "";

    const binName = os.platform() === "win32" ? "cloudflared.exe" : "cloudflared";
    
    // Check paths:
    // 1. Root of app
    // 2. backend directory
    // 3. PATH (global command)
    let binPath = binName;
    const rootPath = path.join(process.cwd(), binName);
    const backendPath = path.join(process.cwd(), "backend", binName);

    if (fs.existsSync(rootPath)) {
      binPath = rootPath;
    } else if (fs.existsSync(backendPath)) {
      binPath = backendPath;
    }

    console.log(`[Tunnel] Starting cloudflared tunnel on port ${port} using binary: ${binPath}`);

    try {
      this.process = spawn(binPath, ["tunnel", "--url", `http://localhost:${port}`]);
    } catch (err) {
      console.error("[Tunnel] Failed to spawn cloudflared process:", err);
      this.isStarting = false;
      this.process = null;
      return "";
    }

    this.process.stdout?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(`[Tunnel stdout] ${text}`);
      this.parseOutput(text);
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(`[Tunnel stderr] ${text}`);
      this.parseOutput(text);
    });

    this.process.on("error", (err) => {
      console.error("[Tunnel] cloudflared process error event:", err.message);
      this.process = null;
      this.publicUrl = "";
      this.isStarting = false;
    });

    this.process.on("close", (code) => {
      console.log(`[Tunnel] cloudflared process exited with code ${code}`);
      this.process = null;
      this.publicUrl = "";
      this.isStarting = false;

      // Auto-retry if exited unexpectedly (not killed by us) and we still want to expose the server
      if (code !== null && code !== 0 && this.targetExpose && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 15000);
        console.log(`[Tunnel] Retrying tunnel connection in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => {
          if (this.targetExpose) {
            this.start(this.port);
          }
        }, delay);
      }
    });

    // Wait up to 15 seconds to find the URL
    return new Promise((resolve) => {
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if (this.publicUrl) {
          clearInterval(interval);
          this.isStarting = false;
          this.retryCount = 0; // Reset retry on success
          resolve(this.publicUrl);
        } else if (checks >= 30 || !this.process) {
          clearInterval(interval);
          this.isStarting = false;
          resolve("");
        }
      }, 500);
    });
  }

  stop(): void {
    this.targetExpose = false;
    if (!this.process) return;
    console.log("[Tunnel] Stopping cloudflared tunnel...");
    // Reset retries since we are intentionally stopping
    this.retryCount = this.maxRetries; 
    this.process.kill();
    this.process = null;
    this.publicUrl = "";
    this.isStarting = false;
  }

  private parseOutput(text: string): void {
    // Look for: https://xxx.trycloudflare.com
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && match[0]) {
      const url = match[0];
      if (this.publicUrl !== url) {
        this.publicUrl = url;
        console.log(`[Tunnel] 🚀 Public secure URL generated: ${url}`);
      }
    }
  }
}

export const tunnelManager = new TunnelManager();
