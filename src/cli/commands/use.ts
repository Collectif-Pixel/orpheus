import { defineCommand } from "citty";
import { existsSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";
import { ui } from "../ui";

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
      ui.log.success(`Theme ${ui.primary("default")}`);
      return;
    }

    if (!themeName.startsWith("@") || !themeName.includes("/")) {
      ui.log.error("Invalid format. Use: @user/theme-name");
      ui.log.info("Or use 'default' for the built-in theme");
      process.exit(1);
    }

    const themeHtml = join(getThemesDir(), themeName, "theme.html");
    if (!existsSync(themeHtml)) {
      ui.log.error(`Theme ${themeName} not found`);
      ui.log.info(`Install with: orpheus add ${themeName}`);
      process.exit(1);
    }

    config.currentTheme = themeName;
    saveConfig(config);

    ui.log.success(`Theme ${ui.primary(themeName)}`);
  },
});
