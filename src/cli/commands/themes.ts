import { defineCommand } from "citty";
import consola from "consola";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig } from "../../core/config";

interface ThemePackageJson {
  name?: string;
  version?: string;
  orpheus?: {
    displayName?: string;
    author?: string;
  };
}

interface ThemeInfo {
  name: string;
  displayName: string;
  version: string;
  author: string;
  active: boolean;
}

export const themesCommand = defineCommand({
  meta: {
    name: "themes",
    description: "List installed themes",
  },
  async run() {
    const themesDir = getThemesDir();
    const config = loadConfig();
    const themes: ThemeInfo[] = [];

    themes.push({
      name: "default",
      displayName: "Default",
      version: "built-in",
      author: "Orpheus",
      active: config.currentTheme === "default",
    });

    if (!existsSync(themesDir)) {
      printThemes(themes);
      return;
    }

    const entries = readdirSync(themesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      if (entry.name.startsWith("@")) {
        const scopeDir = join(themesDir, entry.name);
        const scopeEntries = readdirSync(scopeDir, { withFileTypes: true });

        for (const themeEntry of scopeEntries) {
          if (!themeEntry.isDirectory()) continue;

          const themeName = `${entry.name}/${themeEntry.name}`;
          const themeInfo = getThemeInfo(join(scopeDir, themeEntry.name), themeName);
          if (themeInfo) {
            themeInfo.active = config.currentTheme === themeName;
            themes.push(themeInfo);
          }
        }
      } else {
        const themeInfo = getThemeInfo(join(themesDir, entry.name), entry.name);
        if (themeInfo) {
          themeInfo.active = config.currentTheme === entry.name;
          themes.push(themeInfo);
        }
      }
    }

    printThemes(themes);
  },
});

function getThemeInfo(themePath: string, themeName: string): ThemeInfo | null {
  if (!existsSync(join(themePath, "theme.html"))) return null;

  let pkg: ThemePackageJson = {};
  const packageJsonPath = join(themePath, "package.json");

  if (existsSync(packageJsonPath)) {
    try {
      pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    } catch {}
  }

  return {
    name: themeName,
    displayName: pkg.orpheus?.displayName || themeName,
    version: pkg.version || "unknown",
    author: pkg.orpheus?.author || "unknown",
    active: false,
  };
}

function printThemes(themes: ThemeInfo[]): void {
  if (themes.length === 0) {
    consola.info("No themes installed");
    consola.info("Install a theme with: orpheus add @user/theme");
    return;
  }

  consola.info(`Installed themes (${themes.length}):\n`);

  for (const theme of themes) {
    const marker = theme.active ? " *" : "";
    const line = `  ${theme.name}${marker}`;
    const info = `v${theme.version} by ${theme.author}`;

    if (theme.active) {
      consola.success(`${line} (${info})`);
    } else {
      console.log(`${line} (${info})`);
    }
  }

  console.log("");
  consola.info("* = active theme");
}
