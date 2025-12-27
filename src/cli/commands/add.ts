import { defineCommand } from "citty";
import { $ } from "bun";
import consola from "consola";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";

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
      consola.error("Invalid theme name. Use format: @user/theme-name");
      consola.info("Example: orpheus add @roseratugo/neon");
      process.exit(1);
    }

    const [scope, name] = themeName.slice(1).split("/");
    if (!scope || !name) {
      consola.error("Invalid theme name format");
      process.exit(1);
    }

    const themesDir = getThemesDir();
    const scopeDir = join(themesDir, `@${scope}`);
    const themeDir = join(scopeDir, name);

    if (existsSync(themeDir)) {
      consola.warn(`Theme ${themeName} is already installed`);
      consola.info("To update, remove it first: orpheus remove " + themeName);
      return;
    }

    if (!existsSync(scopeDir)) {
      mkdirSync(scopeDir, { recursive: true });
    }

    const repoUrl = `https://github.com/${scope}/${name}.git`;
    consola.start(`Installing ${themeName} from ${repoUrl}...`);

    try {
      await $`git clone --depth 1 ${repoUrl} ${themeDir}`.quiet();
    } catch {
      consola.error(`Failed to clone repository: ${repoUrl}`);
      consola.info("Make sure the repository exists and is public");
      process.exit(1);
    }

    const themeHtml = join(themeDir, "theme.html");
    if (!existsSync(themeHtml)) {
      consola.error("Invalid theme: theme.html not found");
      consola.info("Removing invalid theme...");
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

    consola.success(`Theme ${themeName} installed successfully`);
    consola.info(`Use it with: orpheus use ${themeName}`);
  },
});
