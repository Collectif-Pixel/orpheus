import { defineCommand } from "citty";
import consola from "consola";
import { isDaemonRunning, getLogFilePath } from "../../core/daemon";
import { loadConfig } from "../../core/config";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show the Orpheus daemon status",
  },
  async run() {
    const { running, pid } = isDaemonRunning();
    const config = loadConfig();

    if (running) {
      consola.success(`Orpheus is running (PID: ${pid})`);
      consola.info(`Server: http://localhost:${config.port}`);
      consola.info(`Theme: ${config.currentTheme}`);
      consola.info(`Logs: ${getLogFilePath()}`);
    } else {
      consola.info("Orpheus is not running");
    }
  },
});
