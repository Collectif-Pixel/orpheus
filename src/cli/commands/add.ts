import { defineCommand } from "citty";
import { $ } from "bun";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";
import { ui } from "../ui";

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Install a theme from GitHub",
  },
  args: {
    theme: {
      type: "positional",
      description: "Theme to install (e.g., @user/theme-name)",
      required: true,
    },
  },
  async run({ args }) {
    const themeName = args.theme as string;

    if (!themeName.startsWith("@") || !themeName.includes("/")) {
      ui.log.error("Invalid format. Use: @user/theme-name");
      ui.log.info("Example: orpheus add @roseratugo/neon");
      process.exit(1);
    }

    const [scope, name] = themeName.slice(1).split("/");
    if (!scope || !name) {
      ui.log.error("Invalid theme name");
      process.exit(1);
    }

    const themesDir = getThemesDir();
    const scopeDir = join(themesDir, `@${scope}`);
    const themeDir = join(scopeDir, name);

    if (existsSync(themeDir)) {
      ui.log.warning(`${themeName} already installed`);
      ui.log.info(`Remove first: orpheus remove ${themeName}`);
      return;
    }

    if (!existsSync(scopeDir)) {
      mkdirSync(scopeDir, { recursive: true });
    }

    const repoUrl = `https://github.com/${scope}/${name}.git`;
    ui.spinner(`Installing ${ui.primary(themeName)}...`);

    try {
      await $`git clone --depth 1 ${repoUrl} ${themeDir}`.quiet();
    } catch {
      ui.log.error(`Failed to clone: ${repoUrl}`);
      ui.log.info("Make sure the repository exists and is public");
      process.exit(1);
    }

    const themeHtml = join(themeDir, "theme.html");
    if (!existsSync(themeHtml)) {
      ui.log.error("Invalid theme: theme.html not found");
      await $`rm -rf ${themeDir}`.quiet();
      process.exit(1);
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

    const config = loadConfig();
    config.themes[themeName] = {
      repo: `github:${scope}/${name}`,
      version,
      path: themeDir,
    };
    saveConfig(config);

    ui.br();
    ui.log.success(`Installed ${ui.primary(themeName)}`);
    ui.log.info(`Use it: orpheus use ${themeName}`);
    ui.br();
  },
});
