import { defineCommand } from "citty";
import { $ } from "bun";
import consola from "consola";
import { existsSync, readdirSync, rmdirSync } from "fs";
import { join, dirname } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";

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
      consola.error("Cannot remove the default theme");
      return;
    }

    if (!themeName.startsWith("@") || !themeName.includes("/")) {
      consola.error("Invalid theme name. Use format: @user/theme-name");
      process.exit(1);
    }

    const themesDir = getThemesDir();
    const themeDir = join(themesDir, themeName);

    if (!existsSync(themeDir)) {
      consola.error(`Theme ${themeName} is not installed`);
      return;
    }

    const config = loadConfig();

    if (config.currentTheme === themeName) {
      consola.warn(`${themeName} is the current theme, switching to default`);
      config.currentTheme = "default";
    }

    consola.start(`Removing ${themeName}...`);

    try {
      await $`rm -rf ${themeDir}`.quiet();
    } catch (error) {
      consola.error(`Failed to remove theme: ${(error as Error).message}`);
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

    consola.success(`Theme ${themeName} removed`);
  },
});
