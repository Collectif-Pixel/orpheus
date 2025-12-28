const PREFIX = "[Orpheus]";

export const logger = {
  info: (msg: string) => console.log(`${PREFIX} ${msg}`),
  error: (msg: string) => console.error(`${PREFIX} ${msg}`),
  server: (port: number) => {
    console.log(`${PREFIX} Server running at http://localhost:${port}`);
    console.log(`${PREFIX} Open http://localhost:${port}/now-playing in OBS Browser Source`);
  },
  shutdown: () => console.log(`\n${PREFIX} Shutting down...`),
};
