import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { getConfigDir } from "./config";

const PID_FILE = "orpheus.pid";
const LOG_FILE = "orpheus.log";

export function getPidFilePath(): string {
  return join(getConfigDir(), PID_FILE);
}

export function getLogFilePath(): string {
  return join(getConfigDir(), LOG_FILE);
}

export function writePid(pid: number): void {
  writeFileSync(getPidFilePath(), pid.toString());
}

export function readPid(): number | null {
  const pidPath = getPidFilePath();
  if (!existsSync(pidPath)) return null;

  try {
    const content = readFileSync(pidPath, "utf-8").trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function cleanupPid(): void {
  const pidPath = getPidFilePath();
  if (existsSync(pidPath)) {
    try {
      unlinkSync(pidPath);
    } catch {}
  }
}

export function isDaemonRunning(): { running: boolean; pid: number | null } {
  const pid = readPid();

  if (!pid) {
    return { running: false, pid: null };
  }

  if (isRunning(pid)) {
    return { running: true, pid };
  }

  cleanupPid();
  return { running: false, pid: null };
}

export function stopDaemon(): { stopped: boolean; pid: number | null } {
  const { running, pid } = isDaemonRunning();

  if (!running || !pid) {
    return { stopped: false, pid: null };
  }

  try {
    process.kill(pid, "SIGTERM");
    cleanupPid();
    return { stopped: true, pid };
  } catch {
    return { stopped: false, pid };
  }
}
