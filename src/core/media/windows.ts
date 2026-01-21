import { spawn, type Subprocess } from "bun";
import { MediaDetector } from "./index";
import type { NowPlayingData } from "../types";
import { fetchCoverArt } from "./cover-fallback";

function detectImageMimeType(base64Data: string): string {
  try {
    const bytes = Buffer.from(base64Data.slice(0, 16), "base64");
    const hex = bytes.toString("hex").toUpperCase();

    if (hex.startsWith("FFD8FF")) return "image/jpeg";
    if (hex.startsWith("89504E47")) return "image/png";
    if (hex.startsWith("474946")) return "image/gif";
    if (hex.startsWith("52494646") && hex.substring(16, 24) === "57454250") return "image/webp";
  } catch {}

  return "image/jpeg";
}

const PS_INIT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

function Await($WinRtTask, $ResultType) {
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

function Get-Artwork($mediaProps) {
  if ($mediaProps.Thumbnail) {
    try {
      $stream = Await ($mediaProps.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
      $reader = [Windows.Storage.Streams.DataReader]::new($stream)
      Await ($reader.LoadAsync($stream.Size)) ([uint32]) | Out-Null
      $bytes = New-Object byte[] $stream.Size
      $reader.ReadBytes($bytes)
      $artwork = [Convert]::ToBase64String($bytes)
      $reader.Dispose()
      $stream.Dispose()
      return $artwork
    } catch {}
  }
  return $null
}
`;

const STREAM_SCRIPT = `${PS_INIT}
function Get-MediaInfo {
  try {
    $sessionManager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $session = $sessionManager.GetCurrentSession()

    if ($null -eq $session) { return $null }

    $mediaProps = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $playbackInfo = $session.GetPlaybackInfo()

    @{
      title = $mediaProps.Title
      artist = $mediaProps.Artist
      album = $mediaProps.AlbumTitle
      playing = $playbackInfo.PlaybackStatus -eq 'Playing'
      artwork = Get-Artwork $mediaProps
    }
  } catch { $null }
}

$lastTitle = ""
$lastArtist = ""

while ($true) {
  $info = Get-MediaInfo
  if ($null -ne $info -and ($info.title -ne $lastTitle -or $info.artist -ne $lastArtist)) {
    $lastTitle = $info.title
    $lastArtist = $info.artist
    $info | ConvertTo-Json -Compress
  }
  Start-Sleep -Milliseconds 500
}
`;

const GET_SCRIPT = `${PS_INIT}
try {
  $sessionManager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $session = $sessionManager.GetCurrentSession()

  if ($null -eq $session) {
    Write-Output '{}'
    exit
  }

  $mediaProps = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $playbackInfo = $session.GetPlaybackInfo()
  $timelineProps = $session.GetTimelineProperties()

  $result = @{
    title = $mediaProps.Title
    artist = $mediaProps.Artist
    album = $mediaProps.AlbumTitle
    playing = $playbackInfo.PlaybackStatus -eq 'Playing'
    duration = $timelineProps.EndTime.TotalSeconds
    elapsedTime = $timelineProps.Position.TotalSeconds
    artworkData = Get-Artwork $mediaProps
  }

  $result | ConvertTo-Json -Compress
} catch {
  Write-Output '{}'
}
`;

export class WindowsMediaDetector extends MediaDetector {
  private streamProcess: Subprocess | null = null;

  async start(): Promise<void> {
    this.startStreaming();
  }

  private startStreaming(): void {
    this.streamProcess = spawn(
      ["powershell", "-NoProfile", "-Command", STREAM_SCRIPT],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    this.readStream();
  }

  private async readStream(): Promise<void> {
    const stdout = this.streamProcess?.stdout;
    if (!stdout || typeof stdout === "number") return;

    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            this.processLine(line);
          }
        }
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private async processLine(line: string): Promise<void> {
    try {
      const data = JSON.parse(line);

      if (!data.title) return;

      let coverUrl: string | undefined;

      if (data.artwork) {
        coverUrl = `data:${detectImageMimeType(data.artwork)};base64,${data.artwork}`;
      } else {
        // Fallback to MusicBrainz Cover Art Archive
        const fallbackCover = await fetchCoverArt(
          data.artist,
          data.album,
          data.title
        );
        coverUrl = fallbackCover || undefined;
      }

      const track: NowPlayingData = {
        title: data.title || "Unknown Title",
        artist: data.artist || "Unknown Artist",
        album: data.album || undefined,
        playing: data.playing ?? true,
        coverUrl,
      };

      if (this.hasTrackChanged(track)) {
        this.emitTrack(track);
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private hasTrackChanged(newTrack: NowPlayingData): boolean {
    if (!this.currentTrack) return true;
    return (
      this.currentTrack.title !== newTrack.title ||
      this.currentTrack.artist !== newTrack.artist
    );
  }

  async getNowPlaying(): Promise<NowPlayingData | null> {
    try {
      const proc = spawn(["powershell", "-NoProfile", "-Command", GET_SCRIPT], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const output = await new Response(proc.stdout).text();
      await proc.exited;

      const data = JSON.parse(output.trim() || "{}");

      if (!data.title) return null;

      let coverUrl: string | undefined;

      if (data.artworkData) {
        coverUrl = `data:${detectImageMimeType(data.artworkData)};base64,${data.artworkData}`;
      } else {
        // Fallback to MusicBrainz Cover Art Archive
        const fallbackCover = await fetchCoverArt(
          data.artist,
          data.album,
          data.title
        );
        coverUrl = fallbackCover || undefined;
      }

      const track: NowPlayingData = {
        title: data.title || "Unknown Title",
        artist: data.artist || "Unknown Artist",
        album: data.album || undefined,
        playing: data.playing ?? true,
        duration: data.duration || undefined,
        elapsedTime: data.elapsedTime || undefined,
        coverUrl,
      };

      this.currentTrack = track;
      return track;
    } catch (error) {
      this.emit("error", error);
      return null;
    }
  }

  stop(): void {
    if (this.streamProcess) {
      this.streamProcess.kill();
      this.streamProcess = null;
    }
  }
}
