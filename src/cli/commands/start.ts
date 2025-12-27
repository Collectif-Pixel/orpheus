import { defineCommand } from "citty";
import { spawn, $ } from "bun";
import consola from "consola";
import { startServer } from "../../server";
import { loadConfig, ensureConfigDir } from "../../core/config";
import { isDaemonRunning, writePid, getLogFilePath } from "../../core/daemon";

export const startCommand = defineCommand({
  meta: {
    name: "start",
    description: "Start the Orpheus server",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port to run the server on",
    },
    foreground: {
      type: "boolean",
      alias: "f",
      description: "Run in foreground (keep terminal open)",
      default: false,
    },
  },
  async run({ args }) {
    const config = loadConfig();
    const port = args.port ? parseInt(args.port, 10) : config.port;

    const { running, pid: existingPid } = isDaemonRunning();
    if (running) {
      consola.warn(`Orpheus is already running (PID: ${existingPid})`);
      consola.info(`Use 'orpheus stop' to stop it first`);
      return;
    }

    if (args.foreground) {
      consola.start("Starting Orpheus in foreground mode...");
      try {
        await startServer(port);
      } catch (error) {
        handleStartError(error, port);
      }
    } else {
      consola.start("Starting Orpheus daemon...");

      try {
        ensureConfigDir();
        const logPath = getLogFilePath();

        const child = spawn({
          cmd: [process.execPath, "start", "--foreground", "--port", port.toString()],
          stdout: "ignore",
          stderr: "ignore",
          stdin: "ignore",
        });

        await $`echo "=== Orpheus started at $(date) ===" >> ${logPath}`.quiet();
        await new Promise((resolve) => setTimeout(resolve, 800));

        if (child.exitCode !== null) {
          consola.error("Failed to start daemon");
          process.exit(1);
        }

        writePid(child.pid);
        child.unref();

        consola.success(`Orpheus started (PID: ${child.pid})`);
        consola.info(`Server running at http://localhost:${port}`);
        consola.info(`Logs: ${logPath}`);
      } catch (error) {
        handleStartError(error, port);
      }
    }
  },
});

function handleStartError(error: unknown, port: number): void {
  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    consola.error(`Port ${port} is already in use`);
    process.exit(1);
  }

  if ((error as Error).message?.includes("media-control")) {
    consola.error("media-control not found. Install it with:");
    consola.info("  brew install media-control");
    process.exit(1);
  }

  throw error;
}
