import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { OrpheusConfig } from "./types";

const CONFIG_DIR = join(homedir(), ".orpheus");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const THEMES_DIR = join(CONFIG_DIR, "themes");

const DEFAULT_CONFIG: OrpheusConfig = {
  port: 3000,
  currentTheme: "default",
  themes: {},
};

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(THEMES_DIR)) {
    mkdirSync(THEMES_DIR, { recursive: true });
  }
}

export function loadConfig(): OrpheusConfig {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: OrpheusConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getThemesDir(): string {
  return THEMES_DIR;
}
