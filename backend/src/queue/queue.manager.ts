import { v4 as uuidv4 } from "uuid";
import { getTrackMetadata } from "../utils/youtube.js";

// ─── Types ───────────────────────────────────────────────────
export interface QueueItem {
  uuid: string;
  youtubeId: string;
  title?: string;
  artist?: string;
  audioUrl?: string;
  duration?: number;
}

// ─── Singleton ───────────────────────────────────────────────
class QueueManager {
  private queue: QueueItem[] = [];
  private history: string[] = [];
  private failedNotifications: { youtubeId: string; title: string }[] = [];
  
  // Background metadata resolver queue
  private pendingMetadata: QueueItem[] = [];
  private activeResolutions = 0;
  private readonly MAX_CONCURRENT_RESOLUTIONS = 2;

  /** Adds a failed notification for status polling. */
  addFailedNotification(youtubeId: string, title: string) {
    this.failedNotifications.push({ youtubeId, title });
  }

  /** Gets and clears all failed notifications. */
  getAndClearFailedNotifications() {
    const notifications = [...this.failedNotifications];
    this.failedNotifications = [];
    return notifications;
  }

  /** Returns a shallow copy of the current queue. */
  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  /** Creates a new QueueItem and pushes it to the back of the queue. */
  add(youtubeId: string): QueueItem {
    const trackNumber = String(this.queue.length + 1).padStart(2, '0');
    const item: QueueItem = {
      uuid: uuidv4(),
      youtubeId,
      title: `Canción #${trackNumber}`,
      artist: "Cargando..."
    };
    this.queue.push(item);

    // Enqueue metadata resolution in background
    this.enqueueMetadataResolve(item, false);

    console.log(`[Queue] Added ${youtubeId} (size: ${this.queue.length})`);
    return item;
  }

  /** Prepends a track to the front of the queue (used when going back). */
  prepend(youtubeId: string): QueueItem {
    const item: QueueItem = {
      uuid: uuidv4(),
      youtubeId,
      title: "Canción #01",
      artist: "Cargando..."
    };
    this.queue.unshift(item);

    // Enqueue metadata resolution with high priority
    this.enqueueMetadataResolve(item, true);

    console.log(`[Queue] Prepended ${youtubeId} (size: ${this.queue.length})`);
    return item;
  }

  private enqueueMetadataResolve(item: QueueItem, prioritize: boolean) {
    if (prioritize) {
      this.pendingMetadata.unshift(item);
    } else {
      this.pendingMetadata.push(item);
    }
    this.processMetadataQueue();
  }

  private processMetadataQueue() {
    if (this.activeResolutions >= this.MAX_CONCURRENT_RESOLUTIONS) {
      return;
    }

    const nextItem = this.pendingMetadata.shift();
    if (!nextItem) {
      return;
    }

    this.activeResolutions++;
    getTrackMetadata(nextItem.youtubeId)
      .then((metadata) => {
        const found = this.queue.find((q) => q.uuid === nextItem.uuid);
        if (found) {
          found.title = metadata.title;
          found.artist = metadata.artist;
          found.audioUrl = metadata.url;
          found.duration = metadata.duration;
          console.log(`[Queue] Metadata resolved for ${nextItem.youtubeId}: ${metadata.title}`);
        }
      })
      .catch((err) => {
        console.warn(`[Queue] Failed to load metadata for ${nextItem.youtubeId}:`, err instanceof Error ? err.message : String(err));
        this.addFailedNotification(
          nextItem.youtubeId,
          nextItem.title && !nextItem.title.startsWith("Cargando...") ? nextItem.title : "Canción en cola"
        );
        this.remove(nextItem.uuid);
      })
      .finally(() => {
        this.activeResolutions--;
        this.processMetadataQueue();
      });

    // Try to start another concurrent resolution if slots are available
    this.processMetadataQueue();
  }

  /** Removes and returns the item at the front, or undefined if empty. */
  next(): QueueItem | undefined {
    return this.queue.shift();
  }

  /** Empties the queue entirely. */
  clear(): void {
    this.queue = [];
    this.pendingMetadata = [];
    console.log("[Queue] Cleared");
  }

  /** Shuffles the queue in-place using Fisher-Yates algorithm. */
  shuffle(): void {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = this.queue[i]!;
      this.queue[i] = this.queue[j]!;
      this.queue[j] = temp;
    }
    console.log("[Queue] Shuffled");
  }

  /** Removes a specific item by its UUID. Returns true if removed, false otherwise. */
  remove(uuid: string): boolean {
    const index = this.queue.findIndex((item) => item.uuid === uuid);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1);
      console.log(`[Queue] Removed track ${removed[0]!.youtubeId} with UUID ${uuid}`);
      return true;
    }
    return false;
  }

  /** Reorders an item within the queue. */
  reorder(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.queue.length || toIndex < 0 || toIndex >= this.queue.length) {
      return;
    }
    const [item] = this.queue.splice(fromIndex, 1);
    if (item) {
      this.queue.splice(toIndex, 0, item);
      console.log(`[Queue] Reordered item from index ${fromIndex} to ${toIndex}`);
    }
  }

  // History Management (rolling capped at 3 items)
  addToHistory(youtubeId: string): void {
    this.history.push(youtubeId);
    if (this.history.length > 3) {
      this.history.shift();
    }
    console.log(`[History] Added ${youtubeId}, current history:`, this.history);
  }

  popHistory(): string | undefined {
    return this.history.pop();
  }

  getHistory(): string[] {
    return [...this.history];
  }
}

export const queueManager = new QueueManager();
