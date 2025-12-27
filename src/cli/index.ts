import { defineCommand, runMain } from "citty";
import { startCommand } from "./commands/start";
import { stopCommand } from "./commands/stop";
import { statusCommand } from "./commands/status";
import { nowCommand } from "./commands/now";
import { themesCommand } from "./commands/themes";
import { addCommand } from "./commands/add";
import { useCommand } from "./commands/use";
import { removeCommand } from "./commands/remove";

const main = defineCommand({
  meta: {
    name: "orpheus",
    version: "0.1.5",
    description: "Now Playing overlay for OBS - Works with any music service",
  },
  subCommands: {
    start: startCommand,
    stop: stopCommand,
    status: statusCommand,
    now: nowCommand,
    themes: themesCommand,
    add: addCommand,
    use: useCommand,
    remove: removeCommand,
  },
});

runMain(main);
