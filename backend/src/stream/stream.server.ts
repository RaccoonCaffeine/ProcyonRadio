import http from "node:http";

class StreamServer {
  private server: http.Server | null = null;
  private subscribers = new Set<http.ServerResponse>();
  public isRunning = false;
  private currentPort = 8000;

  /**
   * Starts the native HTTP server exposing `/radio.mp3`.
   */
  public start(port: number): Promise<void> {
    if (this.isRunning) {
      if (this.currentPort === port) {
        return Promise.resolve();
      }
      this.stop();
    }

    this.currentPort = port;
    this.isRunning = true;

    this.server = http.createServer((req, res) => {
      // Expose the streaming endpoint
      if (req.url === "/radio.mp3") {
        console.log(`[StreamServer] New listener connected from ${req.socket.remoteAddress || "unknown"}`);
        
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Connection": "keep-alive",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "Access-Control-Allow-Origin": "*",
        });

        this.subscribers.add(res);

        req.on("close", () => {
          console.log("[StreamServer] Listener disconnected");
          this.subscribers.delete(res);
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(port, "0.0.0.0", () => {
        console.log(`📡 Embedded local stream server listening on http://0.0.0.0:${port}/radio.mp3`);
        resolve();
      });

      this.server!.on("error", (err) => {
        console.error("❌ Embedded local stream server startup error:", err);
        this.isRunning = false;
        reject(err);
      });
    });
  }

  /**
   * Stops the server and ends all active client streams.
   */
  public stop(): void {
    this.isRunning = false;
    
    for (const res of this.subscribers) {
      try {
        res.end();
      } catch (err) {
        // Ignored
      }
    }
    this.subscribers.clear();

    if (this.server) {
      try {
        this.server.close();
      } catch (err) {
        // Ignored
      }
      this.server = null;
    }
    console.log("[StreamServer] Streaming server stopped");
  }

  /**
   * Restarts the server on a new port.
   */
  public async restart(port: number): Promise<void> {
    console.log(`🔄 Restarting streaming server from port ${this.currentPort} to ${port}...`);
    this.stop();
    await this.start(port);
  }

  /**
   * Broadcasts a chunk of encoded audio to all connected listeners.
   */
  public broadcast(chunk: Buffer): void {
    for (const res of this.subscribers) {
      try {
        res.write(chunk);
      } catch (err) {
        this.subscribers.delete(res);
      }
    }
  }

  /**
   * Gets the port the server is currently configured to run on.
   */
  public getPort(): number {
    return this.currentPort;
  }

  /**
   * Returns the count of currently connected listeners.
   */
  public getListenerCount(): number {
    return this.subscribers.size;
  }
}

export const streamServer = new StreamServer();
