import pc from "picocolors";

const icons = {
  success: "✓",
  error: "✗",
  warning: "!",
  info: "›",
  music: "♫",
  pause: "⏸",
  play: "▶",
  theme: "◆",
  active: "●",
  inactive: "○",
  arrow: "→",
  server: "⚡",
  stop: "■",
};

export const ui = {
  // Colors
  primary: (text: string) => pc.cyan(text),
  success: (text: string) => pc.green(text),
  error: (text: string) => pc.red(text),
  warning: (text: string) => pc.yellow(text),
  dim: (text: string) => pc.dim(text),
  bold: (text: string) => pc.bold(text),
  muted: (text: string) => pc.gray(text),

  // Status messages
  log: {
    success: (msg: string) => console.log(`${pc.green(icons.success)} ${msg}`),
    error: (msg: string) => console.log(`${pc.red(icons.error)} ${msg}`),
    warning: (msg: string) => console.log(`${pc.yellow(icons.warning)} ${msg}`),
    info: (msg: string) => console.log(`${pc.cyan(icons.info)} ${msg}`),
  },

  // Branded header
  header: (title: string) => {
    console.log();
    console.log(`  ${pc.bold(pc.cyan("◆"))} ${pc.bold(title)}`);
    console.log();
  },

  // Now playing box
  nowPlaying: (track: { title: string; artist: string; album?: string; playing: boolean }) => {
    const icon = track.playing ? pc.green(icons.play) : pc.yellow(icons.pause);
    const status = track.playing ? "Now Playing" : "Paused";

    console.log();
    console.log(`  ${icon} ${pc.dim(status)}`);
    console.log(`  ${pc.bold(pc.white(track.title))}`);
    console.log(`  ${pc.cyan(track.artist)}`);
    if (track.album) {
      console.log(`  ${pc.dim(track.album)}`);
    }
    console.log();
  },

  // Server status
  serverStatus: (opts: { running: boolean; pid?: number | null; port?: number; theme?: string; logs?: string }) => {
    console.log();

    if (opts.running) {
      console.log(`  ${pc.green(icons.server)} ${pc.bold("Orpheus")} ${pc.green("running")} ${pc.dim(`(PID: ${opts.pid})`)}`);
      console.log();
      console.log(`  ${pc.dim("Server")}    ${pc.cyan(`http://localhost:${opts.port}`)}`);
      console.log(`  ${pc.dim("Theme")}     ${pc.white(opts.theme || "default")}`);
      console.log(`  ${pc.dim("Logs")}      ${pc.dim(opts.logs || "")}`);
    } else {
      console.log(`  ${pc.dim(icons.stop)} ${pc.bold("Orpheus")} ${pc.dim("stopped")}`);
    }

    console.log();
  },

  // Theme list
  themeList: (themes: Array<{ name: string; version: string; author: string; active: boolean }>) => {
    console.log();
    console.log(`  ${pc.bold(pc.cyan("◆"))} ${pc.bold("Themes")} ${pc.dim(`(${themes.length})`)}`);
    console.log();

    for (const theme of themes) {
      const icon = theme.active ? pc.cyan(icons.active) : pc.dim(icons.inactive);
      const name = theme.active ? pc.cyan(pc.bold(theme.name)) : pc.white(theme.name);
      const meta = pc.dim(`v${theme.version} by ${theme.author}`);

      console.log(`  ${icon} ${name}`);
      console.log(`    ${meta}`);
    }

    console.log();
    console.log(`  ${pc.dim(`${icons.active} = active theme`)}`);
    console.log();
  },

  // Progress indicator
  spinner: (msg: string) => console.log(`  ${pc.cyan("◐")} ${msg}`),

  // Blank line
  br: () => console.log(),
};
