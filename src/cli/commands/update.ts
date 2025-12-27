import { defineCommand } from "citty";
import { $ } from "bun";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";
import { ui } from "../ui";

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Update installed themes",
  },
  args: {
    theme: {
      type: "positional",
      description: "Theme to update (e.g., @user/theme-name) or leave empty for all",
      required: false,
    },
  },
  async run({ args }) {
    const config = loadConfig();
    const themeName = args.theme as string | undefined;

    if (themeName) {
      if (themeName === "default") {
        ui.log.info("Default theme is built-in and cannot be updated");
        return;
      }

      if (!themeName.startsWith("@") || !themeName.includes("/")) {
        ui.log.error("Invalid format. Use: @user/theme-name");
        process.exit(1);
      }

      await updateTheme(themeName, config);
    } else {
      const themes = Object.keys(config.themes);

      if (themes.length === 0) {
        ui.log.info("No themes to update");
        return;
      }

      ui.br();
      for (const theme of themes) {
        await updateTheme(theme, config);
      }
    }
  },
});

async function updateTheme(themeName: string, config: ReturnType<typeof loadConfig>): Promise<void> {
  const [scope, name] = themeName.slice(1).split("/");
  if (!scope || !name) {
    ui.log.error(`Invalid theme: ${themeName}`);
    return;
  }

  const themesDir = getThemesDir();
  const themeDir = join(themesDir, themeName);

  if (!existsSync(themeDir)) {
    ui.log.error(`Theme ${themeName} is not installed`);
    return;
  }

  ui.spinner(`Updating ${ui.primary(themeName)}...`);

  const repoUrl = `https://github.com/${scope}/${name}.git`;

  try {
    await $`rm -rf ${themeDir}`.quiet();
    await $`git clone --depth 1 ${repoUrl} ${themeDir}`.quiet();
  } catch {
    ui.log.error(`Failed to update ${themeName}`);
    return;
  }

  const themeHtml = join(themeDir, "theme.html");
  if (!existsSync(themeHtml)) {
    ui.log.error(`Invalid theme: theme.html not found`);
    await $`rm -rf ${themeDir}`.quiet();
    return;
  }

  let version = "unknown";
  const packageJsonPath = join(themeDir, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      version = pkg.version || "unknown";
    } catch {}
  }

  await $`rm -rf ${join(themeDir, ".git")}`.quiet();

  config.themes[themeName] = {
    repo: `github:${scope}/${name}`,
    version,
    path: themeDir,
  };
  saveConfig(config);

  ui.log.success(`Updated ${ui.primary(themeName)} ${ui.dim(`v${version}`)}`);
}
