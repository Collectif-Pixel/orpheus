import { defineCommand } from "citty";
import consola from "consola";
import { mediaDetector } from "../../core/media";

export const nowCommand = defineCommand({
  meta: {
    name: "now",
    description: "Show currently playing track",
  },
  args: {
    json: {
      type: "boolean",
      alias: "j",
      description: "Output as JSON",
    },
  },
  async run({ args }) {
    try {
      const track = await mediaDetector.getNowPlaying();

      if (!track) {
        consola.warn("No music playing");
        return;
      }

      if (args.json) {
        console.log(JSON.stringify(track, null, 2));
        return;
      }

      consola.box({
        title: track.playing ? "▶ Now Playing" : "⏸ Paused",
        message: `${track.title}\n${track.artist}${track.album ? `\n${track.album}` : ""}`,
        style: {
          borderColor: "cyan",
        },
      });
    } catch (error) {
      if ((error as Error).message?.includes("media-control")) {
        consola.error("media-control not found. Install it with:");
        consola.info("  brew tap ungive/media-control && brew install media-control");
        process.exit(1);
      }

      consola.error("Failed to get now playing info");
    }
  },
});
