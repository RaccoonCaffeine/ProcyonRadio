import fs from "node:fs";
import path from "node:path";

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
  potProviderUrl: string;
}

const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

class SettingsManager {
  private settings!: AppSettings;

  constructor() {
    this.load();
  }

  /**
   * Loads settings from settings.json. If the file does not exist,
   * creates it with defaults merged from environment variables.
   */
  load(): void {
    const dataDir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
        const parsed = JSON.parse(fileContent) as Partial<AppSettings>;
        this.settings = this.mergeWithDefaults(parsed);
      } catch (err) {
        console.error("⚠️ Error reading settings.json, falling back to defaults:", err);
        this.settings = this.getDefaultSettings();
      }
    } else {
      console.log("📝 settings.json not found. Creating with default values...");
      this.settings = this.getDefaultSettings();
      this.save(this.settings);
    }
  }

  /** Returns a copy of the current settings. */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Updates settings and persists them to settings.json.
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
    this.save(this.settings);
  }

  private save(settings: AppSettings): void {
    try {
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), "utf-8");
      console.log("💾 Settings saved successfully");
    } catch (err) {
      console.error("❌ Failed to write settings.json:", err);
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
      potProviderUrl: process.env["POT_PROVIDER_URL"] || defaultPotUrl,
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
      potProviderUrl: parsed.potProviderUrl ?? defaults.potProviderUrl,
    };
  }
}

export const settingsManager = new SettingsManager();
