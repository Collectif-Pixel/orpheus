import { defineCommand } from "citty";
import { mediaDetector } from "../../core/media";
import { ui } from "../ui";

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
        ui.log.warning("No music playing");
        return;
      }

      if (args.json) {
        console.log(JSON.stringify(track, null, 2));
        return;
      }

      ui.nowPlaying(track);
    } catch (error) {
      if ((error as Error).message?.includes("media-control")) {
        ui.log.error("media-control not found");
        ui.log.info("Install with: brew install media-control");
        process.exit(1);
      }

      ui.log.error("Failed to get now playing info");
    }
  },
});
