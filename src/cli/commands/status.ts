import { defineCommand } from "citty";
import { isDaemonRunning, getLogFilePath } from "../../core/daemon";
import { loadConfig } from "../../core/config";
import { ui } from "../ui";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show the Orpheus daemon status",
  },
  async run() {
    const { running, pid } = isDaemonRunning();
    const config = loadConfig();

    ui.serverStatus({
      running,
      pid,
      port: config.port,
      theme: config.currentTheme,
      logs: getLogFilePath(),
    });
  },
});
