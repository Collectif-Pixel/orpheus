import { spawn, type Subprocess } from "bun";
import { MediaDetector } from "./index";
import type { NowPlayingData } from "../types";

const POLL_INTERVAL_MS = 500;

export class LinuxMediaDetector extends MediaDetector {
  private pollInterval: Timer | null = null;
  private followProcess: Subprocess | null = null;

  async start(): Promise<void> {
    const hasFollow = await this.checkPlayerctlFollow();
    if (hasFollow) {
      this.startFollowMode();
    } else {
      this.startPolling();
    }
  }

  private async checkPlayerctlFollow(): Promise<boolean> {
    try {
      const proc = spawn(["playerctl", "--version"], { stdout: "pipe" });
      await proc.exited;
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  }

  private startFollowMode(): void {
    this.followProcess = spawn(
      [
        "playerctl",
        "metadata",
        "--follow",
        "--format",
        '{"title":"{{title}}","artist":"{{artist}}","album":"{{album}}","artUrl":"{{mpris:artUrl}}","status":"{{status}}","length":"{{mpris:length}}","position":"{{position}}"}',
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    this.readFollowStream();
  }

  private async readFollowStream(): Promise<void> {
    const stdout = this.followProcess?.stdout;
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
            this.processPlayerctlOutput(line);
          }
        }
      }
    } catch (error) {
      this.emit("error", error);
      this.startPolling();
    }
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      const track = await this.getNowPlaying();
      if (track && this.hasTrackChanged(track)) {
        this.emitTrack(track);
      }
    }, POLL_INTERVAL_MS);

    this.getNowPlaying().then((track) => {
      if (track) this.emitTrack(track);
    });
  }

  private hasTrackChanged(newTrack: NowPlayingData): boolean {
    if (!this.currentTrack) return true;
    return (
      this.currentTrack.title !== newTrack.title ||
      this.currentTrack.artist !== newTrack.artist
    );
  }

  private async processPlayerctlOutput(line: string): Promise<void> {
    try {
      const data = JSON.parse(line);
      const track = this.parsePlayerctlData(data);

      if (!track.title || !track.artist) return;

      const trackChanged = this.hasTrackChanged(track);
      const artUrl = data.artUrl?.trim();

      if (trackChanged) {
        this.emitTrack(track);
      }

      if (artUrl) {
        const currentTitle = track.title;
        const currentArtist = track.artist;

        if (artUrl.startsWith("file://")) {
          const coverUrl = await this.loadArtworkFromFile(artUrl);
          if (coverUrl && this.currentTrack?.title === currentTitle && this.currentTrack?.artist === currentArtist) {
            this.currentTrack.coverUrl = coverUrl;
            this.emit("track", this.currentTrack);
          }
        } else if (artUrl.startsWith("http://") || artUrl.startsWith("https://")) {
          if (this.currentTrack && this.currentTrack.coverUrl !== artUrl) {
            this.currentTrack.coverUrl = artUrl;
            this.emit("track", this.currentTrack);
          }
        }
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private async loadArtworkFromFile(fileUrl: string): Promise<string | null> {
    try {
      const filePath = fileUrl.replace(/^file:\/\//, "");
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const ext = filePath.split(".").pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp",
        };
        return `data:${mimeTypes[ext || ""] || "image/jpeg"};base64,${base64}`;
      }
    } catch (error) {
      this.emit("error", error);
    }
    return null;
  }

  private parsePlayerctlData(data: {
    title?: string;
    artist?: string;
    album?: string;
    artUrl?: string;
    status?: string;
    length?: string;
    position?: string;
  }): NowPlayingData {
    return {
      title: data.title || "Unknown Title",
      artist: data.artist || "Unknown Artist",
      album: data.album || undefined,
      coverUrl: undefined,
      playing: data.status === "Playing",
      duration: data.length ? parseInt(data.length) / 1000000 : undefined,
      elapsedTime: data.position ? parseInt(data.position) / 1000000 : undefined,
    };
  }

  async getNowPlaying(): Promise<NowPlayingData | null> {
    try {
      const proc = spawn(
        [
          "playerctl",
          "metadata",
          "--format",
          '{"title":"{{title}}","artist":"{{artist}}","album":"{{album}}","artUrl":"{{mpris:artUrl}}","status":"{{status}}","length":"{{mpris:length}}","position":"{{position}}"}',
        ],
        { stdout: "pipe", stderr: "pipe" }
      );

      const output = await new Response(proc.stdout).text();
      await proc.exited;

      if (proc.exitCode !== 0) return null;

      const data = JSON.parse(output.trim());
      const track = this.parsePlayerctlData(data);
      const artUrl = data.artUrl?.trim();
      if (artUrl) {
        if (artUrl.startsWith("file://")) {
          try {
            const filePath = artUrl.replace(/^file:\/\//, "");
            const file = Bun.file(filePath);
            if (await file.exists()) {
              const buffer = await file.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              const ext = filePath.split(".").pop()?.toLowerCase();
              const mimeTypes: Record<string, string> = {
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                gif: "image/gif",
                webp: "image/webp",
              };
              track.coverUrl = `data:${mimeTypes[ext || ""] || "image/jpeg"};base64,${base64}`;
            }
          } catch (error) {
            this.emit("error", error);
          }
        } else if (artUrl.startsWith("http://") || artUrl.startsWith("https://")) {
          track.coverUrl = artUrl;
        }
      }

      this.currentTrack = track;
      return track;
    } catch (error) {
      this.emit("error", error);
      return null;
    }
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.followProcess) {
      this.followProcess.kill();
      this.followProcess = null;
    }
  }
}
