import { defineCommand } from "citty";
import { stopDaemon, isDaemonRunning } from "../../core/daemon";
import { ui } from "../ui";

export const stopCommand = defineCommand({
  meta: {
    name: "stop",
    description: "Stop the Orpheus daemon",
  },
  async run() {
    const { running, pid } = isDaemonRunning();

    if (!running) {
      ui.log.info("Orpheus is not running");
      return;
    }

    ui.spinner("Stopping Orpheus...");
    const { stopped } = stopDaemon();

    if (stopped) {
      ui.log.success(`Orpheus stopped ${ui.dim(`(PID: ${pid})`)}`);
    } else {
      ui.log.error(`Failed to stop Orpheus ${ui.dim(`(PID: ${pid})`)}`);
      process.exit(1);
    }
  },
});
