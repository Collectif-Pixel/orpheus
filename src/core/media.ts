import { getMediaDetector, type MediaDetector } from "./media/index";

let instance: MediaDetector | null = null;
let instancePromise: Promise<MediaDetector> | null = null;

// Queue listeners registered before the instance is ready
const pendingListeners: Array<{ event: string; listener: (...args: any[]) => void }> = [];

async function getInstance(): Promise<MediaDetector> {
  if (instance) return instance;
  if (!instancePromise) {
    instancePromise = getMediaDetector().then((detector) => {
      instance = detector;
      // Flush any listeners that were queued before initialization
      for (const { event, listener } of pendingListeners) {
        instance.on(event, listener);
      }
      pendingListeners.length = 0;
      return detector;
    });
  }
  return instancePromise;
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

  on(event: string, listener: (...args: any[]) => void) {
    if (instance) {
      instance.on(event, listener);
    } else {
      // Queue the listener — it will be flushed when getInstance() resolves
      pendingListeners.push({ event, listener });
      // Kick off initialization if not already started
      getInstance();
    }
    return this;
  },

  off(event: string, listener: (...args: any[]) => void) {
    instance?.off(event, listener);
    return this;
  },
};
