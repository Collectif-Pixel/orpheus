import { defineCommand } from "citty";
import { spawn, $ } from "bun";
import { startServer } from "../../server";
import { loadConfig, ensureConfigDir } from "../../core/config";
import { isDaemonRunning, writePid, getLogFilePath } from "../../core/daemon";
import { DAEMON_START_DELAY_MS } from "../../core/constants";
import { ui } from "../ui";

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

    if (isNaN(port) || port < 1 || port > 65535) {
      ui.log.error("Invalid port. Must be between 1 and 65535");
      process.exit(1);
    }

    const { running, pid: existingPid } = isDaemonRunning();
    if (running) {
      ui.log.warning(`Orpheus already running ${ui.dim(`(PID: ${existingPid})`)}`);
      ui.log.info("Use 'orpheus stop' to stop it first");
      return;
    }

    if (args.foreground) {
      ui.spinner("Starting Orpheus...");
      try {
        ensureConfigDir();
        writePid(process.pid);
        await startServer(port);
      } catch (error) {
        handleStartError(error, port);
      }
    } else {
      ui.spinner("Starting Orpheus daemon...");

      try {
        ensureConfigDir();
        const logPath = getLogFilePath();

        if (process.platform === "win32") {
          // Use PowerShell to create a truly detached process on Windows
          const psScript = `
            $pinfo = New-Object System.Diagnostics.ProcessStartInfo
            $pinfo.FileName = "${process.execPath.replace(/\\/g, "\\\\")}"
            $pinfo.Arguments = "start --foreground --port ${port}"
            $pinfo.CreateNoWindow = $true
            $pinfo.UseShellExecute = $false
            $p = New-Object System.Diagnostics.Process
            $p.StartInfo = $pinfo
            $p.Start() | Out-Null
            Write-Output $p.Id
          `;

          const proc = spawn({
            cmd: ["powershell", "-NoProfile", "-Command", psScript],
            stdout: "pipe",
          });

          const output = await new Response(proc.stdout).text();
          await proc.exited;
          const pid = parseInt(output.trim(), 10);

          await new Promise((resolve) => setTimeout(resolve, DAEMON_START_DELAY_MS));

          try {
            await fetch(`http://localhost:${port}/api/status`, { signal: AbortSignal.timeout(2000) });
          } catch {
            ui.log.error("Failed to start daemon");
            process.exit(1);
          }

          writePid(pid);

          ui.br();
          ui.log.success(`Orpheus started ${ui.dim(`(PID: ${pid})`)}`);
          ui.log.info(`Server ${ui.primary(`http://localhost:${port}`)}`);
          ui.log.info(`Logs ${ui.dim(logPath)}`);
          ui.br();
        } else {
          // Unix: spawn + unref works correctly
          const child = spawn({
            cmd: [process.execPath, "start", "--foreground", "--port", port.toString()],
            stdout: "ignore",
            stderr: "ignore",
            stdin: "ignore",
          });

          await $`echo "=== Orpheus started at $(date) ===" >> ${logPath}`.quiet();
          await new Promise((resolve) => setTimeout(resolve, DAEMON_START_DELAY_MS));

          if (child.exitCode !== null) {
            ui.log.error("Failed to start daemon");
            process.exit(1);
          }

          writePid(child.pid);
          child.unref();

          ui.br();
          ui.log.success(`Orpheus started ${ui.dim(`(PID: ${child.pid})`)}`);
          ui.log.info(`Server ${ui.primary(`http://localhost:${port}`)}`);
          ui.log.info(`Logs ${ui.dim(logPath)}`);
          ui.br();
        }
      } catch (error) {
        handleStartError(error, port);
      }
    }
  },
});

function handleStartError(error: unknown, port: number): void {
  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    ui.log.error(`Port ${port} is already in use`);
    process.exit(1);
  }

  if ((error as Error).message?.includes("media-control")) {
    ui.log.error("media-control not found");
    ui.log.info("Install with: brew install media-control");
    process.exit(1);
  }

  throw error;
}
