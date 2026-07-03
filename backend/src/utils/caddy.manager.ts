import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { settingsManager } from "../settings/settings.manager.js";

class CaddyManager {
  private process: ChildProcess | null = null;
  private isStarting = false;
  private publicUrl = "";

  public getPublicUrl(): string {
    return this.publicUrl;
  }

  public isActive(): boolean {
    return this.process !== null;
  }

  public async start(): Promise<string> {
    const settings = settingsManager.getSettings();
    if (!settings.duckdnsEnabled) {
      return "";
    }

    const { duckdnsDomain, duckdnsToken, port, ownerEmail } = settings;
    if (!duckdnsDomain || !duckdnsToken) {
      console.warn("[Caddy] DuckDNS enabled but domain or token is missing.");
      return "";
    }

    if (this.process) {
      return this.publicUrl;
    }

    this.isStarting = true;
    
    let domain = duckdnsDomain.trim();
    if (!domain.endsWith(".duckdns.org")) {
      domain = `${domain}.duckdns.org`;
    }

    this.publicUrl = `https://${domain}`;

    // Ensure data/logs directory exists
    const dataDir = path.join(process.cwd(), "data");
    const logsDir = path.join(dataDir, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Write Caddyfile
    const caddyfilePath = path.join(dataDir, "Caddyfile");
    const emailBlock = ownerEmail ? `{\n  email ${ownerEmail}\n}` : "";
    const caddyfileContent = `
${emailBlock}

${domain} {
  reverse_proxy localhost:${port}
  tls {
    dns duckdns ${duckdnsToken}
  }
}
`.trim();

    try {
      fs.writeFileSync(caddyfilePath, caddyfileContent, "utf-8");
      console.log(`[Caddy] Dynamic Caddyfile written to ${caddyfilePath}`);
    } catch (err) {
      console.error("[Caddy] Failed to write Caddyfile:", err);
      this.isStarting = false;
      return "";
    }

    // Find Caddy binary
    const binName = os.platform() === "win32" ? "caddy.exe" : "caddy";
    let binPath = binName;
    const pathsToCheck = [
      path.join(dataDir, "bin", binName),
      path.join(process.cwd(), binName),
      path.join(process.cwd(), "backend", binName)
    ];

    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        binPath = p;
        break;
      }
    }

    console.log(`[Caddy] Starting Caddy using binary: ${binPath}`);

    const logFile = path.join(logsDir, "caddy_error.log");
    const logStream = fs.createWriteStream(logFile, { flags: "a", encoding: "utf-8" });

    try {
      this.process = spawn(binPath, ["run", "--config", caddyfilePath, "--adapter", "caddyfile"], {
        env: { ...process.env, DUCKDNS_TOKEN: duckdnsToken }
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        logStream.write(`[STDOUT] ${text}`);
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        logStream.write(`[STDERR] ${text}`);
        if (text.toLowerCase().includes("error") || text.toLowerCase().includes("fail")) {
          console.error(`[Caddy Error] ${text.trim()}`);
        }
      });

      this.process.on("error", (err) => {
        console.error("[Caddy] Process error event:", err.message);
        logStream.write(`[ERROR] Process error event: ${err.message}\n`);
        this.process = null;
        this.publicUrl = "";
        this.isStarting = false;
      });

      this.process.on("close", (code) => {
        console.log(`[Caddy] Process exited with code ${code}`);
        logStream.write(`[EXIT] Process exited with code ${code}\n`);
        this.process = null;
        this.publicUrl = "";
        this.isStarting = false;
      });

    } catch (err) {
      console.error("[Caddy] Failed to spawn caddy process:", err);
      logStream.write(`[ERROR] Failed to spawn caddy process: ${err}\n`);
      this.isStarting = false;
      this.process = null;
      this.publicUrl = "";
      return "";
    }

    this.isStarting = false;
    return this.publicUrl;
  }

  public stop(): void {
    if (!this.process) return;
    console.log("[Caddy] Stopping Caddy proxy...");
    this.process.kill();
    this.process = null;
    this.publicUrl = "";
    this.isStarting = false;
  }

  public restart(): void {
    console.log("[Caddy] Restarting Caddy proxy...");
    this.stop();
    this.start();
  }
}

export const caddyManager = new CaddyManager();
