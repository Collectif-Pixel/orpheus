/**
 * Cover Art Fallback Service
 * Uses MusicBrainz + Cover Art Archive to fetch album covers
 * when the native OS API doesn't provide them.
 */

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const COVERART_API = "https://coverartarchive.org";
const USER_AGENT = "Orpheus/1.0 (https://github.com/music-presence/orpheus)";

interface MusicBrainzRelease {
  id: string;
  title: string;
  "artist-credit"?: Array<{ name: string }>;
}

interface MusicBrainzSearchResult {
  releases: MusicBrainzRelease[];
}

interface CoverArtImage {
  image: string;
  thumbnails: {
    small?: string;
    large?: string;
    "250"?: string;
    "500"?: string;
    "1200"?: string;
  };
  front: boolean;
}

interface CoverArtResult {
  images: CoverArtImage[];
}

// Simple in-memory cache to avoid repeated API calls
const coverCache = new Map<string, string | null>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const cacheTimestamps = new Map<string, number>();

function getCacheKey(artist: string, album: string, title: string): string {
  return `${artist.toLowerCase()}|${album?.toLowerCase() || title.toLowerCase()}`;
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
  coverCache.set(key, value);
  cacheTimestamps.set(key, Date.now());
}

async function searchMusicBrainz(
  artist: string,
  album?: string,
  title?: string
): Promise<string | null> {
  try {
    // Build search query - prefer album, fallback to track title
    const searchTerm = album || title;
    if (!searchTerm) return null;

    const query = encodeURIComponent(
      `release:"${searchTerm}" AND artist:"${artist}"`
    );
    const url = `${MUSICBRAINZ_API}/release/?fmt=json&limit=5&query=${query}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as MusicBrainzSearchResult;

    if (!data.releases || data.releases.length === 0) return null;

    // Return the first matching release ID
    const firstRelease = data.releases[0];
    return firstRelease ? firstRelease.id : null;
  } catch {
    return null;
  }
}

async function fetchCoverFromArchive(mbid: string): Promise<string | null> {
  try {
    const url = `${COVERART_API}/release/${mbid}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as CoverArtResult;

    if (!data.images || data.images.length === 0) return null;

    // Find front cover, or use first image
    const frontCover = data.images.find((img) => img.front) ?? data.images[0];
    if (!frontCover) return null;

    // Prefer 500px thumbnail for balance of quality and size
    return (
      frontCover.thumbnails["500"] ||
      frontCover.thumbnails["250"] ||
      frontCover.thumbnails.large ||
      frontCover.image
    );
  } catch {
    return null;
  }
}

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Fetches album cover art using MusicBrainz + Cover Art Archive
 * Returns a base64 data URL or null if not found
 */
export async function fetchCoverArt(
  artist: string,
  album?: string,
  title?: string
): Promise<string | null> {
  if (!artist) return null;

  const cacheKey = getCacheKey(artist, album || "", title || "");
  const cached = getFromCache(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  try {
    // Step 1: Search MusicBrainz for the release
    const mbid = await searchMusicBrainz(artist, album, title);
    if (!mbid) {
      setCache(cacheKey, null);
      return null;
    }

    // Step 2: Fetch cover from Cover Art Archive
    const coverUrl = await fetchCoverFromArchive(mbid);
    if (!coverUrl) {
      setCache(cacheKey, null);
      return null;
    }

    // Step 3: Download and convert to base64
    const base64Cover = await fetchImageAsBase64(coverUrl);
    setCache(cacheKey, base64Cover);

    return base64Cover;
  } catch {
    setCache(cacheKey, null);
    return null;
  }
}
