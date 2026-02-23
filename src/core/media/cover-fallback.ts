/**
 * Cover Art Fallback Service
 * Uses Deezer public API to fetch album covers
 * when the native OS API doesn't provide them.
 */

const DEEZER_API = "https://api.deezer.com";

interface DeezerTrack {
  id: number;
  title: string;
  artist: {
    name: string;
  };
  album: {
    title: string;
    cover_medium: string;
    cover_big: string;
  };
}

interface DeezerSearchResult {
  data: DeezerTrack[];
}

// Simple in-memory cache to avoid repeated API calls
const coverCache = new Map<string, string | null>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const CACHE_MAX_SIZE = 200;
const cacheTimestamps = new Map<string, number>();

function getCacheKey(artist: string, title: string): string {
  return `${artist.toLowerCase()}|${title.toLowerCase()}`;
}

function getFromCache(key: string): string | null | undefined {
  const timestamp = cacheTimestamps.get(key);
  if (timestamp && Date.now() - timestamp > CACHE_TTL) {
    coverCache.delete(key);
    cacheTimestamps.delete(key);
    return undefined;
  }
  return coverCache.get(key);
}

function setCache(key: string, value: string | null): void {
  // Evict oldest entry when cache is full (O(n) linear scan)
  if (coverCache.size >= CACHE_MAX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, t] of cacheTimestamps) {
      if (t < oldestTime) {
        oldestTime = t;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      coverCache.delete(oldestKey);
      cacheTimestamps.delete(oldestKey);
    }
  }
  coverCache.set(key, value);
  cacheTimestamps.set(key, Date.now());
}

async function searchDeezer(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    // Build search query
    const query = encodeURIComponent(`track:"${title}" artist:"${artist}"`);
    const url = `${DEEZER_API}/search?q=${query}&limit=1`;

    const response = await fetch(url);

    if (!response.ok) return null;

    const data = (await response.json()) as DeezerSearchResult;

    if (!data.data || data.data.length === 0) {
      // Try a simpler search without quotes
      const simpleQuery = encodeURIComponent(`${artist} ${title}`);
      const simpleUrl = `${DEEZER_API}/search?q=${simpleQuery}&limit=1`;
      const simpleResponse = await fetch(simpleUrl);

      if (!simpleResponse.ok) return null;

      const simpleData = (await simpleResponse.json()) as DeezerSearchResult;
      if (!simpleData.data || simpleData.data.length === 0) return null;

      const track = simpleData.data[0];
      return track?.album?.cover_big || track?.album?.cover_medium || null;
    }

    const track = data.data[0];
    return track?.album?.cover_big || track?.album?.cover_medium || null;
  } catch {
    return null;
  }
}

/**
 * Fetches album cover art using Deezer API
 * Returns a cover URL or null if not found
 */
export async function fetchCoverArt(
  artist: string,
  _album?: string,
  title?: string
): Promise<string | null> {
  if (!artist || !title) return null;

  const cacheKey = getCacheKey(artist, title);
  const cached = getFromCache(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  try {
    const coverUrl = await searchDeezer(artist, title);
    setCache(cacheKey, coverUrl);
    return coverUrl;
  } catch {
    setCache(cacheKey, null);
    return null;
  }
}
