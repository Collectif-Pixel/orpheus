import { spawn, type Subprocess } from "bun";
import { MediaDetector } from "./index";
import type { NowPlayingData, MediaControlResponse } from "../types";

const FALLBACK_TIMEOUT_MS = 2000;

export class MacOSMediaDetector extends MediaDetector {
  private process: Subprocess | null = null;
  private pendingTrack: NowPlayingData | null = null;
  private pendingTimeout: Timer | null = null;

  async start(): Promise<void> {
    if (this.process) return;

    this.process = spawn(["media-control", "stream"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    this.readStream();
  }

  private async readStream(): Promise<void> {
    const stdout = this.process?.stdout;
    if (!stdout || typeof stdout === "number") return;

    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            this.processLine(line);
          }
        }
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private processLine(line: string): void {
    try {
      const data: MediaControlResponse = JSON.parse(line);
      const payload = data.payload || data;

      if (!payload.title || !payload.artist) {
        if (this.pendingTrack && payload.artworkData && !this.pendingTrack.coverUrl) {
          this.pendingTrack.coverUrl = `data:${payload.artworkMimeType || "image/jpeg"};base64,${payload.artworkData}`;
          if (this.isTrackComplete(this.pendingTrack)) {
            this.emitTrack(this.pendingTrack);
          }
        }
        return;
      }

      const track = this.parseTrack(payload);

      if (this.isNewTrack(track)) {
        if (this.pendingTimeout) {
          clearTimeout(this.pendingTimeout);
          this.pendingTimeout = null;
        }

        this.pendingTrack = track;

        if (this.isTrackComplete(track)) {
          this.emitTrack(track);
        } else {
          this.pendingTimeout = setTimeout(() => {
            if (this.pendingTrack) {
              this.emitTrack(this.pendingTrack);
            }
          }, FALLBACK_TIMEOUT_MS);
        }
        return;
      }

      if (this.pendingTrack && this.isSameTrack(this.pendingTrack, track)) {
        this.mergeTrackData(this.pendingTrack, track);
        if (this.isTrackComplete(this.pendingTrack)) {
          this.emitTrack(this.pendingTrack);
        }
        return;
      }

      if (this.currentTrack && this.isSameTrack(this.currentTrack, track)) {
        if (track.coverUrl && !this.currentTrack.coverUrl) {
          this.currentTrack.coverUrl = track.coverUrl;
          this.emit("track", this.currentTrack);
        }
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private isNewTrack(track: NowPlayingData): boolean {
    const reference = this.pendingTrack || this.currentTrack;
    if (!reference) return true;
    return !this.isSameTrack(reference, track);
  }

  private isSameTrack(a: NowPlayingData, b: NowPlayingData): boolean {
    return a.title === b.title && a.artist === b.artist;
  }

  private isTrackComplete(track: NowPlayingData): boolean {
    return !!(track.title && track.artist && track.coverUrl);
  }

  private mergeTrackData(target: NowPlayingData, source: NowPlayingData): void {
    if (source.coverUrl && !target.coverUrl) target.coverUrl = source.coverUrl;
    if (source.album && !target.album) target.album = source.album;
    if (source.duration && !target.duration) target.duration = source.duration;
  }

  private parseTrack(data: MediaControlResponse): NowPlayingData {
    let coverUrl: string | undefined;

    if (data.artworkData && data.artworkMimeType) {
      coverUrl = `data:${data.artworkMimeType};base64,${data.artworkData}`;
    }

    return {
      title: data.title || "Unknown Title",
      artist: data.artist || "Unknown Artist",
      album: data.album,
      coverUrl,
      playing: data.playing ?? true,
      duration: data.duration,
      elapsedTime: data.elapsedTime,
      bundleIdentifier: data.bundleIdentifier,
    };
  }

  async getNowPlaying(): Promise<NowPlayingData | null> {
    const proc = spawn(["media-control", "get"], { stdout: "pipe" });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    try {
      const data: MediaControlResponse = JSON.parse(output.trim());
      const track = this.parseTrack(data);
      this.currentTrack = track;
      return track;
    } catch (error) {
      this.emit("error", error);
      return null;
    }
  }

  stop(): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
