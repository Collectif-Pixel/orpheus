import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { DEFAULT_PORT } from "./constants";
import type { OrpheusConfig } from "./types";

const CONFIG_DIR = join(homedir(), ".orpheus");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const THEMES_DIR = join(CONFIG_DIR, "themes");

const CURRENT_CONFIG_VERSION = 1;

const DEFAULT_CONFIG: OrpheusConfig = {
  configVersion: CURRENT_CONFIG_VERSION,
  port: DEFAULT_PORT,
  currentTheme: "default",
  themes: {},
};

function migrateConfig(config: Partial<OrpheusConfig>): OrpheusConfig {
  const version = config.configVersion ?? 0;

  if (version < CURRENT_CONFIG_VERSION) {
    config.configVersion = CURRENT_CONFIG_VERSION;
  }

  return { ...DEFAULT_CONFIG, ...config };
}

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
    const parsed = JSON.parse(content);
    const config = migrateConfig(parsed);

    if (config.configVersion !== parsed.configVersion) {
      saveConfig(config);
    }

    return config;
  } catch {
    console.error("Failed to load config, using defaults");
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
