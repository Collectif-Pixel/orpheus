import { join } from "path";
import { existsSync, readFileSync, statSync } from "fs";
import { mediaDetector } from "../core/media";
import { loadConfig, getThemesDir } from "../core/config";
import { cleanupPid } from "../core/daemon";
import { defaultTheme } from "../themes/default";
import { SSE_KEEP_ALIVE_MS, VERSION } from "../core/constants";
import { logger } from "../core/logger";
import type { NowPlayingData } from "../core/types";

const sseClients = new Set<WritableStreamDefaultWriter<Uint8Array>>();
const encoder = new TextEncoder();

const SSE_RECONNECT_MS = 2000;

function broadcast(data: NowPlayingData): void {
  const message = encoder.encode(`event: track\ndata: ${JSON.stringify(data)}\n\n`);
  for (const writer of sseClients) {
    writer.write(message).catch(() => sseClients.delete(writer));
  }
}

mediaDetector.on("track", (track: NowPlayingData) => broadcast(track));
mediaDetector.on("error", (error: Error) => {
  logger.error(`Media detection error: ${error.message}`);
});

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// In-memory cache for custom theme files
const themeCache = new Map<string, { content: string; mtime: number }>();

function loadThemeFile(themePath: string): string | null {
  if (!existsSync(themePath)) return null;

  try {
    const mtime = statSync(themePath).mtimeMs;
    const cached = themeCache.get(themePath);

    if (cached && cached.mtime === mtime) {
      return cached.content;
    }

    const content = readFileSync(themePath, "utf-8");
    themeCache.set(themePath, { content, mtime });
    return content;
  } catch {
    return null;
  }
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

    // Send retry hint so the browser handles reconnection natively
    writer.write(encoder.encode(`retry: ${SSE_RECONNECT_MS}\n\n`));

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
    const content = loadThemeFile(themePath);

    if (!content) {
      return new Response(`Theme "${themeName}" not found`, { status: 404 });
    }

    return new Response(content, {
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
  logger.shutdown();
  // Force exit after 5 seconds if graceful shutdown hangs
  const forceTimeout = setTimeout(() => process.exit(1), 5000);
  forceTimeout.unref?.();

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

  try {
    Bun.serve({
      port,
      fetch: handleRequest,
      idleTimeout: 0,
    });
  } catch (err: any) {
    if (err?.code === "EADDRINUSE" || err?.message?.includes("address already in use")) {
      const error = new Error(`Port ${port} is already in use`) as NodeJS.ErrnoException;
      error.code = "EADDRINUSE";
      throw error;
    }
    throw err;
  }

  logger.server(port);
}
