import { defineCommand } from "citty";
import consola from "consola";
import { stopDaemon, isDaemonRunning } from "../../core/daemon";

export const stopCommand = defineCommand({
  meta: {
    name: "stop",
    description: "Stop the Orpheus daemon",
  },
  async run() {
    const { running, pid } = isDaemonRunning();

    if (!running) {
      consola.info("Orpheus is not running");
      return;
    }

    consola.start("Stopping Orpheus...");

    const { stopped } = stopDaemon();

    if (stopped) {
      consola.success(`Orpheus stopped (PID: ${pid})`);
    } else {
      consola.error(`Failed to stop Orpheus (PID: ${pid})`);
      process.exit(1);
    }
  },
});
