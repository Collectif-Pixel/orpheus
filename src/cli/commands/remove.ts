import { defineCommand } from "citty";
import { existsSync, readdirSync, rmdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";
import { ui } from "../ui";

export const removeCommand = defineCommand({
  meta: {
    name: "remove",
    description: "Remove an installed theme",
  },
  args: {
    theme: {
      type: "positional",
      description: "Theme to remove (e.g., @user/theme-name)",
      required: true,
    },
  },
  async run({ args }) {
    const themeName = args.theme as string;

    if (themeName === "default") {
      ui.log.error("Cannot remove the default theme");
      return;
    }

    if (!themeName.startsWith("@") || !themeName.includes("/")) {
      ui.log.error("Invalid format. Use: @user/theme-name");
      process.exit(1);
    }

    const themesDir = getThemesDir();
    const themeDir = join(themesDir, themeName);

    if (!existsSync(themeDir)) {
      ui.log.error(`Theme ${themeName} is not installed`);
      return;
    }

    const config = loadConfig();

    if (config.currentTheme === themeName) {
      ui.log.warning(`Switching to default (${themeName} was active)`);
      config.currentTheme = "default";
    }

    ui.spinner(`Removing ${themeName}...`);

    try {
      rmSync(themeDir, { recursive: true, force: true });
    } catch (error) {
      ui.log.error(`Failed: ${(error as Error).message}`);
      process.exit(1);
    }

    const scopeDir = dirname(themeDir);
    try {
      if (readdirSync(scopeDir).length === 0) {
        rmdirSync(scopeDir);
      }
    } catch {}

    delete config.themes[themeName];
    saveConfig(config);

    ui.log.success(`Removed ${ui.dim(themeName)}`);
  },
});
