import fs from "node:fs";
import path from "node:path";
import { dbService } from "../database/database.service.js";

export interface AppSettings {
  port: number;
  outputMode: "youtube" | "icecast";
  allowGuestAdd: boolean;
  exposeServer: boolean;
  youtube: {
    rtmpUrl: string;
    streamKey: string;
  };
  icecast: {
    serverUrl: string;
    format: "mp3" | "aac";
    bitrate: string;
  };
  fadeDuration: number;
  fallbackVolume: number;
  potProviderUrl: string;
  streamPort: number;
  useCloudflare: boolean;
  localBitrate: string;
  streamServerEnabled: boolean;
  duckdnsEnabled: boolean;
  duckdnsDomain: string;
  duckdnsToken: string;
  stationAlias: string;
  stationLanguage: "es" | "en";
  ownerEmail: string;
}

class SettingsManager {
  private settings!: AppSettings;

  constructor() {
    this.load();
  }

  /**
   * Loads settings from SQLite system_settings table. If empty, checks for a legacy settings.json.
   * If both are empty, initializes with default values.
   */
  load(): void {
    const db = dbService.getDb();
    
    // First, check if there are settings in DB
    const rows = db.prepare("SELECT key, value FROM system_settings").all() as { key: string; value: string }[];
    
    if (rows.length > 0) {
      // Load from DB
      const parsed: Partial<AppSettings> = {};
      for (const row of rows) {
        const key = row.key as keyof AppSettings;
        const val = row.value;
        
        if (key === "youtube" || key === "icecast") {
          try {
            parsed[key] = JSON.parse(val);
          } catch {}
        } else if (key === "port" || key === "fadeDuration" || key === "fallbackVolume" || key === "streamPort") {
          parsed[key] = Number(val) as any;
        } else if (key === "allowGuestAdd" || key === "exposeServer" || key === "useCloudflare" || key === "streamServerEnabled" || key === "duckdnsEnabled") {
          parsed[key] = (val === "true") as any;
        } else {
          parsed[key] = val as any;
        }
      }
      this.settings = this.mergeWithDefaults(parsed);
      return;
    }

    // If DB is empty, check if we have a legacy settings.json
    let legacyPath = path.join(process.cwd(), "data", "settings.json");
    if (!fs.existsSync(legacyPath)) {
      legacyPath = path.join(process.cwd(), "..", "data", "settings.json");
    }

    if (fs.existsSync(legacyPath)) {
      try {
        console.log(`📝 Migrating legacy settings.json (${legacyPath}) to SQLite...`);
        const fileContent = fs.readFileSync(legacyPath, "utf-8");
        const parsed = JSON.parse(fileContent) as Partial<AppSettings>;
        this.settings = this.mergeWithDefaults(parsed);
        this.saveToDb(this.settings);
        this.cleanupLegacyJson(legacyPath);
        return;
      } catch (err) {
        console.error("⚠️ Failed to migrate legacy settings.json:", err);
      }
    }

    // Otherwise, initialize with defaults
    console.log("📝 Initializing SQLite settings with default values...");
    this.settings = this.getDefaultSettings();
    this.saveToDb(this.settings);
  }

  /** Returns a copy of the current settings. */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Updates settings and persists them to SQLite system_settings table.
   * If some fields are missing, they will be left unchanged.
   */
  update(newSettings: Partial<AppSettings>): void {
    this.settings = {
      ...this.settings,
      ...newSettings,
      // Handle nested structures properly
      youtube: {
        ...this.settings.youtube,
        ...(newSettings.youtube || {}),
      },
      icecast: {
        ...this.settings.icecast,
        ...(newSettings.icecast || {}),
      },
    };
    this.saveToDb(this.settings);
  }

  private saveToDb(settings: AppSettings): void {
    try {
      const db = dbService.getDb();
      const stmt = db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)");
      
      for (const [k, v] of Object.entries(settings)) {
        const strValue = typeof v === "object" ? JSON.stringify(v) : String(v);
        stmt.run(k, strValue);
      }
      console.log("💾 Settings saved successfully to SQLite");
    } catch (err) {
      console.error("❌ Failed to write settings to SQLite:", err);
    }
  }

  private cleanupLegacyJson(filePath?: string): void {
    try {
      const pathsToClean = filePath ? [filePath] : [
        path.join(process.cwd(), "data", "settings.json"),
        path.join(process.cwd(), "..", "data", "settings.json")
      ];
      for (const p of pathsToClean) {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.log(`🧹 Legacy settings.json removed: ${p}`);
        }
      }
    } catch (err) {
      console.warn("⚠️ Failed to remove legacy settings.json:", err);
    }
  }

  private getDefaultSettings(): AppSettings {
    const isDocker = fs.existsSync("/.dockerenv");
    const defaultPotUrl = isDocker ? "http://pot-provider:4416" : "http://localhost:4416";

    return {
      port: Number(process.env["PORT"]) || 3000,
      outputMode: (process.env["OUTPUT_MODE"] as "youtube" | "icecast") || "youtube",
      allowGuestAdd: true,
      exposeServer: process.env["EXPOSE_SERVER"] === "true",
      youtube: {
        rtmpUrl: process.env["YOUTUBE_RTMP_URL"] || "rtmp://a.rtmp.youtube.com/live2",
        streamKey: process.env["YOUTUBE_STREAM_KEY"] || "",
      },
      icecast: {
        serverUrl: process.env["ICECAST_SERVER_URL"] || "",
        format: (process.env["ICECAST_FORMAT"] as "mp3" | "aac") || "mp3",
        bitrate: process.env["ICECAST_BITRATE"] || "128k",
      },
      fadeDuration: Number(process.env["FADE_DURATION"]) || 3,
      fallbackVolume: Number(process.env["FALLBACK_VOLUME"]) || 5,
      potProviderUrl: process.env["POT_PROVIDER_URL"] || defaultPotUrl,
      streamPort: Number(process.env["STREAM_PORT"]) || 8000,
      useCloudflare: process.env["USE_CLOUDFLARE"] === "true" || false,
      localBitrate: process.env["LOCAL_BITRATE"] || "320k",
      streamServerEnabled: process.env["STREAM_SERVER_ENABLED"] !== "false",
      duckdnsEnabled: process.env["DUCKDNS_ENABLED"] === "true" || false,
      duckdnsDomain: process.env["DUCKDNS_DOMAIN"] || "",
      duckdnsToken: process.env["DUCKDNS_TOKEN"] || "",
      stationAlias: process.env["STATION_ALIAS"] || "ProcyonRadio",
      stationLanguage: (process.env["STATION_LANGUAGE"] as "es" | "en") || "es",
      ownerEmail: process.env["OWNER_EMAIL"] || "",
    };
  }

  private mergeWithDefaults(parsed: Partial<AppSettings>): AppSettings {
    const defaults = this.getDefaultSettings();
    return {
      port: parsed.port ?? defaults.port,
      outputMode: parsed.outputMode ?? defaults.outputMode,
      allowGuestAdd: parsed.allowGuestAdd ?? defaults.allowGuestAdd,
      exposeServer: parsed.exposeServer ?? defaults.exposeServer,
      youtube: {
        rtmpUrl: parsed.youtube?.rtmpUrl ?? defaults.youtube.rtmpUrl,
        streamKey: parsed.youtube?.streamKey ?? defaults.youtube.streamKey,
      },
      icecast: {
        serverUrl: parsed.icecast?.serverUrl ?? defaults.icecast.serverUrl,
        format: parsed.icecast?.format ?? defaults.icecast.format,
        bitrate: parsed.icecast?.bitrate ?? defaults.icecast.bitrate,
      },
      fadeDuration: parsed.fadeDuration ?? defaults.fadeDuration,
      fallbackVolume: parsed.fallbackVolume ?? defaults.fallbackVolume,
      potProviderUrl: parsed.potProviderUrl ?? defaults.potProviderUrl,
      streamPort: parsed.streamPort ?? defaults.streamPort,
      useCloudflare: parsed.useCloudflare ?? defaults.useCloudflare,
      localBitrate: parsed.localBitrate ?? defaults.localBitrate,
      streamServerEnabled: parsed.streamServerEnabled ?? defaults.streamServerEnabled,
      duckdnsEnabled: parsed.duckdnsEnabled ?? defaults.duckdnsEnabled,
      duckdnsDomain: parsed.duckdnsDomain ?? defaults.duckdnsDomain,
      duckdnsToken: parsed.duckdnsToken ?? defaults.duckdnsToken,
      stationAlias: parsed.stationAlias ?? defaults.stationAlias,
      stationLanguage: parsed.stationLanguage ?? defaults.stationLanguage,
      ownerEmail: parsed.ownerEmail ?? defaults.ownerEmail,
    };
  }
}

export const settingsManager = new SettingsManager();
