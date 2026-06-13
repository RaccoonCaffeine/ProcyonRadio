import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { settingsManager } from "../settings/settings.manager.js";

const execAsync = promisify(exec);

/**
 * Returns the absolute path or command name for yt-dlp.
 * If running on Windows, checks if yt-dlp.exe is in the application root directory.
 */
function getYtDlpCommand(): string {
  if (process.platform === "win32") {
    // En pkg, process.execPath apunta al ejecutable de Node dentro del snapshot
    let execDir = process.execPath;
    if (execDir.includes("node.exe")) {
      execDir = path.dirname(path.dirname(execDir));
    } else {
      execDir = path.dirname(execDir);
    }
    
    const exePath1 = path.join(execDir, "yt-dlp.exe");
    if (fs.existsSync(exePath1)) {
      return `"${exePath1}"`;
    }
    
    const localExe = path.join(process.cwd(), "yt-dlp.exe");
    if (fs.existsSync(localExe)) {
      return `"${localExe}"`;
    }
    
    return "yt-dlp.exe";
  }
  return "yt-dlp";
}

function normalizeUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "music.youtube.com") {
      parsed.hostname = "www.youtube.com";
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

/** Check if url is a YouTube link. */
function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be") ||
      parsed.hostname.includes("youtube-nocookie.com")
    );
  } catch {
    return false;
  }
}

/** Check if url is a SoundCloud link. */
function isSoundCloudUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("soundcloud.com") ||
      parsed.hostname.includes("snd.sc")
    );
  } catch {
    return false;
  }
}

export async function extractYoutubeIds(url: string): Promise<string[]> {
  const sanitized = normalizeUrl(url).trim();
  if (!sanitized) return [];

  const ytDlpCmd = getYtDlpCommand();
  const settings = settingsManager.getSettings();

  // SoundCloud URLs (single tracks and playlists/sets) are resolved via yt-dlp
  if (isSoundCloudUrl(sanitized)) {
    try {
      console.log(`[SoundCloud] Extracting tracks from: ${sanitized}`);
      const { stdout } = await execAsync(
        `${ytDlpCmd} --flat-playlist --print webpage_url "${sanitized}"`,
        { timeout: 30000 }
      );
      const urls = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
      if (urls.length > 0) {
        console.log(`[SoundCloud] Found ${urls.length} track(s)`);
        return urls;
      }
      // If flat-playlist returned nothing, return the original URL as a single track
      return [sanitized];
    } catch (err) {
      console.warn(`⚠️ SoundCloud playlist extraction failed, treating as single track:`, err instanceof Error ? err.message : String(err));
      return [sanitized];
    }
  }

  // If it's a direct audio URL (not YouTube, not SoundCloud), return it directly as a pseudo-id
  if (sanitized.startsWith("http") && !isYouTubeUrl(sanitized)) {
    return [sanitized];
  }

  // Conditionally apply PoT Provider base_url if set
  let potArgs = "";
  if (settings.potProviderUrl && settings.potProviderUrl.trim().length > 0) {
    potArgs = `--js-runtimes deno --extractor-args "youtube:player_client=web_embedded;fetch_pot=always" --extractor-args "youtubepot-bgutilhttp:base_url=${settings.potProviderUrl.trim()}"`;
  }

  try {
    const parsed = new URL(sanitized);
    if (parsed.searchParams.has("list")) {
      const { stdout } = await execAsync(
        `${ytDlpCmd} ${potArgs} --flat-playlist --print id "${sanitized}"`,
      );
      return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
    }
    if (parsed.searchParams.has("v")) {
      const id = parsed.searchParams.get("v");
      if (id) return [id];
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.substring(1);
      if (id) return [id];
    }
  } catch (err) {
    console.warn("⚠️ Native URL parsing failed or list extraction failed, using fallback:", err);
  }

  try {
    const { stdout } = await execAsync(
      `${ytDlpCmd} ${potArgs} --flat-playlist --print id "${sanitized}"`,
    );
    return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  } catch (err) {
    console.error("❌ yt-dlp ID extraction failed:", err);
    return [];
  }
}

export interface TrackMetadata {
  url: string;
  title: string;
  artist: string;
  duration: number;
}

export interface SearchResult {
  youtubeId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}

export async function getTrackMetadata(id: string): Promise<TrackMetadata> {
  const sanitizedId = id.trim();
  
  // If the ID is actually a direct stream URL (excluding SoundCloud)
  if (sanitizedId.startsWith("http") && !isSoundCloudUrl(sanitizedId)) {
    try {
      const parsed = new URL(sanitizedId);
      return {
        url: sanitizedId,
        title: "Transmisión en Vivo",
        artist: parsed.hostname,
        duration: 0, // 0 = Infinite / Live Radio stream
      };
    } catch {
      return {
        url: sanitizedId,
        title: "Audio Directo",
        artist: "Radio Externa",
        duration: 0,
      };
    }
  }

  const videoUrl = isSoundCloudUrl(sanitizedId) ? sanitizedId : `https://www.youtube.com/watch?v=${sanitizedId}`;
  const ytDlpCmd = getYtDlpCommand();
  const settings = settingsManager.getSettings();

  let potArgs = "";
  if (!isSoundCloudUrl(sanitizedId) && settings.potProviderUrl && settings.potProviderUrl.trim().length > 0) {
    potArgs = `--js-runtimes deno --extractor-args "youtube:player_client=web_embedded;fetch_pot=always" --extractor-args "youtubepot-bgutilhttp:base_url=${settings.potProviderUrl.trim()}"`;
  }

  try {
    const { stdout } = await execAsync(
      `${ytDlpCmd} ${potArgs} -f "bestaudio" --dump-json "${videoUrl}"`,
    );
    const data = JSON.parse(stdout);
    return {
      url: data.url || "",
      title: data.title || "Unknown Title",
      artist: data.uploader || data.artist || "Unknown Channel",
      duration: Number(data.duration) || 0,
    };
  } catch (err) {
    console.warn(`⚠️ YouTube stream extraction failed for ${sanitizedId}, trying SoundCloud fallback...`);
    
    // Step 1: Try to retrieve title and uploader without requesting streaming formats
    let query = "";
    try {
      const { stdout: infoOut } = await execAsync(
        `${ytDlpCmd} --skip-download --print "%(uploader)s - %(title)s" "${videoUrl}"`
      );
      query = infoOut.trim();
    } catch (infoErr) {
      console.warn(`⚠️ Could not retrieve YouTube video info for query:`, infoErr);
    }

    if (!query) {
      throw err; // If we can't even get the text title, propagate the original error
    }

    // Step 2: Search SoundCloud for the query
    console.log(`🔍 Searching SoundCloud for fallback: "${query}"`);
    try {
      const escapedQuery = query.replace(/"/g, '\\"');
      const { stdout: scOut } = await execAsync(
        `${ytDlpCmd} -f "bestaudio" --dump-json "scsearch1:${escapedQuery}"`
      );
      const data = JSON.parse(scOut);
      console.log(`🎉 Found SoundCloud match: "${data.title}"`);
      return {
        url: data.url || "",
        title: `[SC] ${data.title || "Unknown"}`,
        artist: data.uploader || data.artist || "SoundCloud Artist",
        duration: Number(data.duration) || 0,
      };
    } catch (scErr) {
      console.error(`❌ SoundCloud fallback match failed for: "${query}"`, scErr);
      throw err; // propagate original error
    }
  }
}

export async function searchTracks(query: string): Promise<SearchResult[]> {
  const ytDlpCmd = getYtDlpCommand();
  const settings = settingsManager.getSettings();
  
  let potArgs = "";
  if (settings.potProviderUrl && settings.potProviderUrl.trim().length > 0) {
    potArgs = `--js-runtimes deno --extractor-args "youtube:player_client=web_embedded;fetch_pot=always" --extractor-args "youtubepot-bgutilhttp:base_url=${settings.potProviderUrl.trim()}"`;
  }

  const escapedQuery = query.replace(/"/g, '\\"');
  try {
    // --flat-playlist is fast as it does not retrieve final video source URLs
    const { stdout } = await execAsync(
      `${ytDlpCmd} ${potArgs} --flat-playlist --dump-json "ytsearch5:${escapedQuery}"`
    );
    const lines = stdout.split("\n").filter((line) => line.trim().length > 0);
    const results: SearchResult[] = [];
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.id) {
          results.push({
            youtubeId: data.id,
            title: data.title || "Unknown Title",
            artist: data.uploader || data.artist || "Unknown Channel",
            duration: Number(data.duration) || 0,
            thumbnail: data.thumbnail || `https://img.youtube.com/vi/${data.id}/default.jpg`
          });
        }
      } catch (e) {
        console.error("Error parsing JSON line from yt-dlp search:", e);
      }
    }
    return results;
  } catch (err) {
    console.error("❌ yt-dlp search failed:", err);
    return [];
  }
}
