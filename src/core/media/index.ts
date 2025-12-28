import { EventEmitter } from "events";
import type { NowPlayingData } from "../types";

export abstract class MediaDetector extends EventEmitter {
  protected currentTrack: NowPlayingData | null = null;

  abstract start(): Promise<void>;
  abstract stop(): void;
  abstract getNowPlaying(): Promise<NowPlayingData | null>;

  getCurrentTrack(): NowPlayingData | null {
    return this.currentTrack;
  }

  protected emitTrack(track: NowPlayingData): void {
    this.currentTrack = track;
    this.emit("track", track);
  }
}

export async function createMediaDetector(): Promise<MediaDetector> {
  const platform = process.platform;

  switch (platform) {
    case "darwin": {
      const { MacOSMediaDetector } = await import("./macos");
      return new MacOSMediaDetector();
    }
    case "linux": {
      const { LinuxMediaDetector } = await import("./linux");
      return new LinuxMediaDetector();
    }
    case "win32": {
      const { WindowsMediaDetector } = await import("./windows");
      return new WindowsMediaDetector();
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function getMediaDetector(): Promise<MediaDetector> {
  return createMediaDetector();
}
