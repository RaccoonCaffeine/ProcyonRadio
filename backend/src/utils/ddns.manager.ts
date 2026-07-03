import { settingsManager } from "../settings/settings.manager.js";

class DdnsManager {
  private intervalId: NodeJS.Timeout | null = null;
  private isUpdating = false;

  public start(): void {
    if (this.intervalId) {
      return;
    }
    // Run update immediately on startup
    this.updateIp();

    // Set interval to run every 10 minutes (600,000 ms)
    this.intervalId = setInterval(() => {
      this.updateIp();
    }, 600000);
    console.log("[DDNS] DuckDNS service started (polling every 10 minutes)");
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[DDNS] DuckDNS service stopped");
    }
  }

  public restart(): void {
    console.log("[DDNS] Restarting DuckDNS service with new settings...");
    this.stop();
    this.start();
  }

  private async updateIp(): Promise<void> {
    const settings = settingsManager.getSettings();
    if (!settings.duckdnsEnabled) {
      return;
    }

    const { duckdnsDomain, duckdnsToken } = settings;
    if (!duckdnsDomain || !duckdnsToken) {
      console.warn("[DDNS] DuckDNS is enabled but domain or token is missing.");
      return;
    }

    if (this.isUpdating) {
      return;
    }
    this.isUpdating = true;

    try {
      console.log(`[DDNS] Updating DuckDNS domain '${duckdnsDomain}'...`);
      const url = `https://www.duckdns.org/update?domains=${encodeURIComponent(duckdnsDomain)}&token=${encodeURIComponent(duckdnsToken)}&ip=`;
      const response = await fetch(url);
      const text = await response.text();

      if (text.trim() === "OK") {
        console.log(`[DDNS] DuckDNS update successful for '${duckdnsDomain}'`);
      } else {
        console.error(`[DDNS] DuckDNS update returned non-OK status: '${text}'`);
      }
    } catch (err) {
      console.error("[DDNS] Failed to update DuckDNS IP:", err instanceof Error ? err.message : String(err));
    } finally {
      this.isUpdating = false;
    }
  }
}

export const ddnsManager = new DdnsManager();
