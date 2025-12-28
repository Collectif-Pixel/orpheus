export interface NowPlayingData {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  playing: boolean;
  duration?: number;
  elapsedTime?: number;
  bundleIdentifier?: string;
}

export interface MediaControlResponse {
  title?: string;
  artist?: string;
  album?: string;
  artworkData?: string;
  artworkMimeType?: string;
  playing?: boolean;
  duration?: number;
  elapsedTime?: number;
  bundleIdentifier?: string;
  diff?: boolean;
  payload?: MediaControlResponse;
}

export interface OrpheusConfig {
  configVersion: number;
  port: number;
  currentTheme: string;
  themes: Record<string, ThemeConfig>;
}

export interface ThemeConfig {
  repo: string;
  version: string;
  path: string;
}
