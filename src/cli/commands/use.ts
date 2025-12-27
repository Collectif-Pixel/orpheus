import { defineCommand } from "citty";
import consola from "consola";
import { existsSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";

export const useCommand = defineCommand({
  meta: {
    name: "use",
    description: "Set the active theme",
  },
  args: {
    theme: {
      type: "positional",
      description: "Theme to use (e.g., @user/theme-name or default)",
      required: true,
    },
  },
  async run({ args }) {
    const themeName = args.theme as string;
    const config = loadConfig();

    if (themeName === "default") {
      config.currentTheme = "default";
      saveConfig(config);
      consola.success("Switched to default theme");
      return;
    }

    if (!themeName.startsWith("@") || !themeName.includes("/")) {
      consola.error("Invalid theme name. Use format: @user/theme-name");
      consola.info("Or use 'default' for the built-in theme");
      process.exit(1);
    }

    const themeHtml = join(getThemesDir(), themeName, "theme.html");
    if (!existsSync(themeHtml)) {
      consola.error(`Theme ${themeName} not found`);
      consola.info("Install it with: orpheus add " + themeName);
      process.exit(1);
    }

    config.currentTheme = themeName;
    saveConfig(config);

    consola.success(`Switched to theme: ${themeName}`);
    consola.info("Restart Orpheus for changes to take effect");
  },
});
