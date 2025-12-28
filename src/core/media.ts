import { getMediaDetector, type MediaDetector } from "./media/index";

let instance: MediaDetector | null = null;

async function getInstance(): Promise<MediaDetector> {
  if (!instance) {
    instance = await getMediaDetector();
  }
  return instance;
}

export const mediaDetector = {
  async start(): Promise<void> {
    const detector = await getInstance();
    return detector.start();
  },

  stop(): void {
    instance?.stop();
  },

  async getNowPlaying() {
    const detector = await getInstance();
    return detector.getNowPlaying();
  },

  getCurrentTrack() {
    return instance?.getCurrentTrack() ?? null;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void) {
    getInstance().then((detector) => detector.on(event, listener));
    return this;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, listener: (...args: any[]) => void) {
    instance?.off(event, listener);
    return this;
  },
};
