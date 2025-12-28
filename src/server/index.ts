import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { mediaDetector } from "../core/media";
import { loadConfig, getThemesDir } from "../core/config";
import { cleanupPid } from "../core/daemon";
import { defaultTheme } from "../themes/default";
import { SSE_KEEP_ALIVE_MS, VERSION } from "../core/constants";
import type { NowPlayingData } from "../core/types";

const sseClients = new Set<WritableStreamDefaultWriter<Uint8Array>>();
const encoder = new TextEncoder();

function broadcast(data: NowPlayingData): void {
  const message = encoder.encode(`event: track\ndata: ${JSON.stringify(data)}\n\n`);
  for (const writer of sseClients) {
    writer.write(message).catch(() => sseClients.delete(writer));
  }
}

mediaDetector.on("track", (track: NowPlayingData) => broadcast(track));

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (path === "/api/health") {
    return Response.json({ status: "ok", version: VERSION }, { headers: corsHeaders() });
  }

  if (path === "/api/now-playing") {
    const track = mediaDetector.getCurrentTrack() || (await mediaDetector.getNowPlaying());
    return Response.json(track, { headers: corsHeaders() });
  }

  if (path === "/api/stream") {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    sseClients.add(writer);

    const current = mediaDetector.getCurrentTrack();
    if (current) {
      writer.write(encoder.encode(`event: track\ndata: ${JSON.stringify(current)}\n\n`));
    }

    const keepAlive = setInterval(() => {
      writer.write(encoder.encode(": ping\n\n")).catch(() => {
        clearInterval(keepAlive);
        sseClients.delete(writer);
      });
    }, SSE_KEEP_ALIVE_MS);

    req.signal.addEventListener("abort", () => {
      clearInterval(keepAlive);
      sseClients.delete(writer);
      writer.close().catch(() => {});
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  if (path === "/now-playing") {
    const config = loadConfig();
    const themeName = url.searchParams.get("theme") || config.currentTheme;

    if (themeName === "default") {
      return new Response(defaultTheme, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const themePath = join(getThemesDir(), themeName, "theme.html");
    if (!existsSync(themePath)) {
      return new Response(`Theme "${themeName}" not found`, { status: 404 });
    }

    return new Response(readFileSync(themePath, "utf-8"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (path === "/") {
    const host = req.headers.get("host") || `localhost:${port}`;
    return Response.redirect(`http://${host}/now-playing`, 302);
  }

  return new Response("Not Found", { status: 404 });
}

let port = 4242;

function gracefulShutdown(): void {
  console.log("\nShutting down Orpheus...");
  for (const writer of sseClients) {
    writer.close().catch(() => {});
  }
  sseClients.clear();
  mediaDetector.stop();
  cleanupPid();
  process.exit(0);
}

export async function startServer(serverPort: number): Promise<void> {
  port = serverPort;

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  await mediaDetector.start();
  await mediaDetector.getNowPlaying();

  console.log(`Orpheus server running at http://localhost:${port}`);
  console.log(`Open http://localhost:${port}/now-playing in OBS Browser Source`);

  Bun.serve({
    port,
    fetch: handleRequest,
    idleTimeout: 0,
  });
}
