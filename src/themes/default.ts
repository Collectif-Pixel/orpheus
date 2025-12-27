export const defaultTheme = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orpheus - Now Playing</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      color: white;
      overflow: hidden;
    }

    .container {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      max-width: 400px;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.4s ease;
    }

    .container.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .cover {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      object-fit: cover;
      background: #333;
      flex-shrink: 0;
    }

    .info {
      overflow: hidden;
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    .artist {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .album {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 4px;
    }

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container" id="container">
    <img class="cover" id="cover" src="" alt="Album cover">
    <div class="info">
      <div class="title" id="title">-</div>
      <div class="artist" id="artist">-</div>
      <div class="album" id="album"></div>
    </div>
  </div>

  <script>
    const container = document.getElementById('container');
    const cover = document.getElementById('cover');
    const title = document.getElementById('title');
    const artist = document.getElementById('artist');
    const album = document.getElementById('album');

    let currentTrack = null;

    function updateUI(data) {
      if (!data) {
        container.classList.remove('visible');
        return;
      }

      const trackChanged = !currentTrack ||
        currentTrack.title !== data.title ||
        currentTrack.artist !== data.artist;

      currentTrack = data;

      title.textContent = data.title || '-';
      artist.textContent = data.artist || '-';
      album.textContent = data.album || '';

      if (data.coverUrl) {
        cover.src = data.coverUrl;
        cover.classList.remove('hidden');
      } else {
        cover.classList.add('hidden');
      }

      container.classList.add('visible');

      if (trackChanged) {
        container.style.animation = 'none';
        container.offsetHeight;
        container.style.animation = null;
      }
    }

    function connectSSE() {
      const eventSource = new EventSource('/api/stream');

      eventSource.addEventListener('track', (event) => {
        try {
          const data = JSON.parse(event.data);
          updateUI(data);
        } catch (e) {
          console.error('Failed to parse track data:', e);
        }
      });

      eventSource.addEventListener('ping', () => {});

      eventSource.onerror = () => {
        console.log('SSE connection lost, reconnecting...');
        eventSource.close();
        setTimeout(connectSSE, 2000);
      };
    }

    fetch('/api/now-playing')
      .then(res => res.json())
      .then(updateUI)
      .catch(console.error);

    connectSSE();
  </script>
</body>
</html>`;
