import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { $ } from "bun";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { getThemesDir, loadConfig, saveConfig } from "../../core/config";

const REGISTRY_URL = "https://raw.githubusercontent.com/Collectif-Pixel/orpheus-themes/main/registry.json";

interface Theme {
  name: string;
  displayName: string;
  description: string;
  author: string;
  tags: string[];
}

interface Registry {
  themes: Theme[];
}

export const searchCommand = defineCommand({
  meta: {
    name: "search",
    description: "Browse and install themes from the registry",
  },
  async run() {
    p.intro(pc.cyan("Orpheus Themes"));

    const s = p.spinner();
    s.start("Fetching themes...");

    let registry: Registry;
    try {
      const response = await fetch(REGISTRY_URL);
      registry = await response.json() as Registry;
      s.stop("Themes loaded");
    } catch {
      s.stop("Failed to fetch registry");
      p.cancel("Could not connect to theme registry");
      process.exit(1);
    }

    if (registry.themes.length === 0) {
      p.cancel("No themes available yet");
      process.exit(0);
    }

    const config = loadConfig();
    const installedThemes = Object.keys(config.themes);

    const theme = await p.select({
      message: "Select a theme to install",
      options: registry.themes.map((t) => {
        const installed = installedThemes.includes(t.name);
        const active = config.currentTheme === t.name;

        let status = "";
        if (active) status = pc.cyan(" [active]");
        else if (installed) status = pc.dim(" [installed]");

        return {
          value: t,
          label: `${t.displayName}${status}`,
          hint: `by ${t.author} - ${t.description}`,
        };
      }),
    });

    if (p.isCancel(theme)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const selectedTheme = theme as Theme;
    const isInstalled = installedThemes.includes(selectedTheme.name);

    const action = await p.select({
      message: `What do you want to do with ${selectedTheme.displayName}?`,
      options: isInstalled
        ? [
            { value: "use", label: "Use this theme", hint: "Set as active theme" },
            { value: "update", label: "Update", hint: "Re-download latest version" },
            { value: "remove", label: "Remove", hint: "Uninstall theme" },
            { value: "cancel", label: "Cancel" },
          ]
        : [
            { value: "install", label: "Install", hint: "Download and install" },
            { value: "cancel", label: "Cancel" },
          ],
    });

    if (p.isCancel(action) || action === "cancel") {
      p.cancel("Cancelled");
      process.exit(0);
    }

    const parts = selectedTheme.name.slice(1).split("/");
    const scope = parts[0];
    const name = parts[1] || "";
    const themesDir = getThemesDir();
    const scopeDir = join(themesDir, `@${scope}`);
    const themeDir = join(scopeDir, name);

    if (action === "install" || action === "update") {
      s.start(action === "install" ? "Installing..." : "Updating...");

      if (existsSync(themeDir)) {
        await $`rm -rf ${themeDir}`.quiet();
      }

      if (!existsSync(scopeDir)) {
        mkdirSync(scopeDir, { recursive: true });
      }

      const repoUrl = `https://github.com/${scope}/${name}.git`;

      try {
        await $`git clone --depth 1 ${repoUrl} ${themeDir}`.quiet();
        await $`rm -rf ${join(themeDir, ".git")}`.quiet();

        let version = "unknown";
        const packageJsonPath = join(themeDir, "package.json");
        if (existsSync(packageJsonPath)) {
          try {
            const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
            version = pkg.version || "unknown";
          } catch {}
        }

        config.themes[selectedTheme.name] = {
          repo: `github:${scope}/${name}`,
          version,
          path: themeDir,
        };
        saveConfig(config);

        s.stop(pc.green("Done"));

        const useNow = await p.confirm({
          message: "Use this theme now?",
          initialValue: true,
        });

        if (useNow === true) {
          config.currentTheme = selectedTheme.name;
          saveConfig(config);
          p.outro(pc.green(`Theme set to ${selectedTheme.displayName}`));
        } else {
          p.outro(pc.dim(`Installed. Use with: orpheus use ${selectedTheme.name}`));
        }
      } catch {
        s.stop(pc.red("Failed"));
        p.cancel("Installation failed");
        process.exit(1);
      }
    }

    if (action === "use") {
      config.currentTheme = selectedTheme.name;
      saveConfig(config);
      p.outro(pc.green(`Theme set to ${selectedTheme.displayName}`));
    }

    if (action === "remove") {
      s.start("Removing...");

      try {
        await $`rm -rf ${themeDir}`.quiet();
        delete config.themes[selectedTheme.name];

        if (config.currentTheme === selectedTheme.name) {
          config.currentTheme = "default";
        }

        saveConfig(config);
        s.stop(pc.green("Removed"));
        p.outro(pc.dim("Theme removed"));
      } catch {
        s.stop(pc.red("Failed"));
        p.cancel("Removal failed");
        process.exit(1);
      }
    }
  },
});
