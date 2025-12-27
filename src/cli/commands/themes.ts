import { defineCommand } from "citty";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig } from "../../core/config";
import { ui } from "../ui";

interface ThemeInfo {
  name: string;
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
      version: "built-in",
      author: "Orpheus",
      active: config.currentTheme === "default",
    });

    if (existsSync(themesDir)) {
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
    }

    if (themes.length === 0) {
      ui.log.info("No themes installed");
      ui.log.info("Install a theme with: orpheus add @user/theme");
      return;
    }

    ui.themeList(themes);
  },
});

function getThemeInfo(themePath: string, themeName: string): ThemeInfo | null {
  if (!existsSync(join(themePath, "theme.html"))) return null;

  let version = "unknown";
  let author = "unknown";
  const packageJsonPath = join(themePath, "package.json");

  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      version = pkg.version || "unknown";
      author = pkg.orpheus?.author || pkg.author || "unknown";
    } catch {}
  }

  return { name: themeName, version, author, active: false };
}
