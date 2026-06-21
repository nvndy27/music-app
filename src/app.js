const API_BASE_URL = window.MUSIC_API_BASE_URL || "https://music-app-backend-cfue.onrender.com/api";

const albumGrid = document.querySelector("#albumGrid");
const trackTable = document.querySelector("#trackTable");
const quickGrid = document.querySelector(".quick-grid");
const filterButtons = document.querySelectorAll(".filter-pill");
const searchInput = document.querySelector("#searchInput");
const playerTitle = document.querySelector("#playerTitle");
const playerArtist = document.querySelector("#playerArtist");
const playerCover = document.querySelector("#playerCover");
const playerPlay = document.querySelector("#playerPlay");
const heroPlay = document.querySelector("#heroPlay");
const likeButton = document.querySelector("#likeButton");
const createPlaylistButton = document.querySelector('[aria-label="Create playlist"]');
const progressInput = document.querySelector("#progressInput");
const elapsedTime = document.querySelector("#elapsedTime");
const durationTime = document.querySelector("#durationTime");
const volumeInput = document.querySelector(".volume-wrap input");
const playerBar = document.querySelector(".player-bar");
const nowTrack = document.querySelector(".now-track");
const previousButton = document.querySelector('[aria-label="Previous track"]');
const nextButton = document.querySelector('[aria-label="Next track"]');
const PLAYER_STORAGE_KEY = "pulse-music-player";
const LIBRARY_STORAGE_KEY = "pulse-music-library";

let tracks = [];
let currentMood = "all";
let currentTrackId = null;
let isPlaying = false;
let progressSeconds = 0;
const audio = new Audio();
const playerState = {
  queue: [],
  index: -1,
  history: [],
  repeat: "off",
  shuffle: false,
  autoplay: true,
  speed: 1,
};
const libraryState = loadLibraryState();

audio.preload = "metadata";
audio.volume = Number(volumeInput?.value || 72) / 100;
audio.playbackRate = playerState.speed;

function loadLibraryState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LIBRARY_STORAGE_KEY) || "{}");
    return {
      likedIds: Array.isArray(saved.likedIds) ? saved.likedIds : [],
      playlists: Array.isArray(saved.playlists) ? saved.playlists : [],
      recentlyPlayed: Array.isArray(saved.recentlyPlayed) ? saved.recentlyPlayed.slice(0, 100) : [],
      settings: { autoplay: saved.settings?.autoplay !== false, speed: Number(saved.settings?.speed) || 1 },
    };
  } catch (error) {
    return { likedIds: [], playlists: [], recentlyPlayed: [], settings: { autoplay: true, speed: 1 } };
  }
}

function saveLibraryState() {
  window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(libraryState));
}

playerState.autoplay = libraryState.settings.autoplay;
playerState.speed = libraryState.settings.speed;
audio.playbackRate = playerState.speed;

const nowPlaying = document.createElement("section");
nowPlaying.className = "now-playing";
nowPlaying.hidden = true;
nowPlaying.innerHTML = `
  <button class="now-playing-close" type="button" aria-label="Close now playing">⌄</button>
  <div class="now-playing-art" aria-hidden="true"></div>
  <div class="now-playing-meta"><strong></strong><span></span></div>
  <div class="now-playing-tools">
    <button type="button" data-player-action="queue">Queue</button>
    <button type="button" data-player-action="like">Like</button>
    <button type="button" data-player-action="playlist">Add to playlist</button>
    <button type="button" data-player-action="speed">1x</button>
    <button type="button" data-player-action="autoplay">Autoplay</button>
  </div>
  <div class="now-playing-progress"><span>0:00</span><input type="range" min="0" max="100" value="0" aria-label="Playback progress" /><span>0:00</span></div>
  <div class="now-playing-controls">
    <button type="button" data-player-action="shuffle" aria-label="Shuffle">⇄</button>
    <button type="button" data-player-action="previous" aria-label="Previous track">◀</button>
    <button class="now-playing-play" type="button" data-player-action="toggle" aria-label="Play">▶</button>
    <button type="button" data-player-action="next" aria-label="Next track">▶</button>
    <button type="button" data-player-action="repeat" aria-label="Repeat off">↻</button>
  </div>
`;
document.body.append(nowPlaying);

const nowPlayingArt = nowPlaying.querySelector(".now-playing-art");
const nowPlayingTitle = nowPlaying.querySelector(".now-playing-meta strong");
const nowPlayingArtist = nowPlaying.querySelector(".now-playing-meta span");
const nowPlayingProgress = nowPlaying.querySelector(".now-playing-progress input");
const nowPlayingElapsed = nowPlaying.querySelector(".now-playing-progress span:first-child");
const nowPlayingDuration = nowPlaying.querySelector(".now-playing-progress span:last-child");
const queuePanel = document.createElement("aside");
queuePanel.className = "queue-panel";
queuePanel.hidden = true;
document.body.append(queuePanel);

function isGuestSession() {
  try {
    return JSON.parse(window.localStorage.getItem("pulse-music-auth-session") || "null")?.mode === "guest";
  } catch (error) {
    return false;
  }
}

function requireAccount(action) {
  if (!isGuestSession()) return true;

  console.info("[guest] blocked action", { action });
  window.alert(`${action} is available after you sign in.`);
  return false;
}

function isLiked(trackId) {
  return libraryState.likedIds.includes(trackId);
}

function toggleLiked(trackId = currentTrackId) {
  if (!trackId) return;
  libraryState.likedIds = isLiked(trackId)
    ? libraryState.likedIds.filter((id) => id !== trackId)
    : [...libraryState.likedIds, trackId];
  saveLibraryState();
  likeButton.classList.toggle("active", isLiked(trackId));
  renderAll();
}

function recordRecentlyPlayed(track) {
  if (!track?.id) return;
  libraryState.recentlyPlayed = [track.id, ...libraryState.recentlyPlayed.filter((id) => id !== track.id)].slice(0, 100);
  saveLibraryState();
}

function createPlaylist() {
  const name = window.prompt("Playlist name");
  if (!name?.trim()) return;
  libraryState.playlists.push({ id: crypto.randomUUID(), name: name.trim(), trackIds: [] });
  saveLibraryState();
  renderPlaylists();
}

function addCurrentTrackToPlaylist() {
  const track = getCurrentTrack();
  if (!track) return;
  if (!libraryState.playlists.length) createPlaylist();
  const playlist = libraryState.playlists[0];
  if (!playlist || playlist.trackIds.includes(track.id)) return;
  playlist.trackIds.push(track.id);
  saveLibraryState();
}

function renderPlaylists() {
  const libraryBox = document.querySelector(".library-box");
  if (!libraryBox) return;
  libraryBox.querySelectorAll(".local-playlist").forEach((item) => item.remove());
  libraryState.playlists.forEach((playlist) => {
    const button = document.createElement("button");
    button.className = "playlist-link local-playlist";
    button.type = "button";
    button.textContent = playlist.name;
    button.addEventListener("click", () => {
      const queue = playlist.trackIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
      if (queue.length) setQueue(queue, queue[0].id, true);
    });
    libraryBox.append(button);
  });
}

function renderRecentlyPlayed() {
  let section = document.querySelector("#recentlyPlayed");
  if (!section) {
    section = document.createElement("section");
    section.id = "recentlyPlayed";
    section.className = "section-block recently-played";
    document.querySelector(".track-section")?.before(section);
  }
  const recentTracks = libraryState.recentlyPlayed.map((id) => tracks.find((track) => track.id === id)).filter(Boolean).slice(0, 12);
  if (!recentTracks.length) { section.hidden = true; return; }
  section.hidden = false;
  section.innerHTML = `<div class="section-head"><h2>Recently played</h2></div><div class="recent-grid">${recentTracks.map((track) => `<button type="button" data-track-id="${escapeHtml(track.id)}"><span>${escapeHtml(track.title)}</span><small>${escapeHtml(track.artist)}</small></button>`).join("")}</div>`;
}

function icon(name) {
  return `<svg><use href="#icon-${name}"></use></svg>`;
}

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]
  );
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function resolveMediaUrl(path) {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `http://localhost:4000${path.startsWith("/") ? path : `/${path}`}`;
}

function artworkStyle(track) {
  const imageUrl = resolveMediaUrl(track.coverImageUrl || track.coverUrl);

  if (!imageUrl) {
    return "";
  }

  const safeImageUrl = encodeURI(imageUrl).replace(/'/g, "%27");
  return ` style="background-image: url('${safeImageUrl}'); background-size: cover; background-position: center;"`;
}

function applyArtwork(element, track) {
  const imageUrl = resolveMediaUrl(track.coverImageUrl || track.coverUrl);
  element.style.backgroundImage = imageUrl
    ? `url("${encodeURI(imageUrl).replace(/"/g, "%22")}")`
    : "";
  element.style.backgroundSize = imageUrl ? "cover" : "";
  element.style.backgroundPosition = imageUrl ? "center" : "";
}

function getCurrentTrack() {
  return tracks.find((track) => track.id === currentTrackId) || null;
}

function persistPlayerState() {
  try {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify({
      queue: playerState.queue.map((track) => track.id),
      index: playerState.index,
      history: playerState.history.map((track) => track.id),
      repeat: playerState.repeat,
      shuffle: playerState.shuffle,
      position: audio.currentTime || 0,
      volume: audio.volume,
    }));
  } catch (error) {
    console.warn("Could not persist player state:", error);
  }
}

function restorePlayerState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PLAYER_STORAGE_KEY) || "null");
    if (!saved?.queue?.length) return false;

    const queue = saved.queue.map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
    const selected = queue[saved.index] || queue[0];
    if (!selected) return false;

    playerState.queue = queue;
    playerState.index = queue.findIndex((track) => track.id === selected.id);
    playerState.history = (saved.history || []).map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
    playerState.repeat = ["off", "all", "one"].includes(saved.repeat) ? saved.repeat : "off";
    playerState.shuffle = Boolean(saved.shuffle);
    if (Number.isFinite(saved.volume)) {
      audio.volume = saved.volume;
      if (volumeInput) volumeInput.value = String(Math.round(saved.volume * 100));
    }
    setCurrentTrack(selected.id, false);
    const restorePosition = Math.max(0, Number(saved.position) || 0);
    audio.addEventListener("loadedmetadata", () => { audio.currentTime = restorePosition; }, { once: true });
    return true;
  } catch (error) {
    console.warn("Could not restore player state:", error);
    return false;
  }
}

function setQueue(sourceTracks, selectedId, shouldPlay = true) {
  const uniqueTracks = sourceTracks.filter((track, index, list) =>
    track?.id && list.findIndex((item) => item.id === track.id) === index
  );
  const index = uniqueTracks.findIndex((track) => track.id === selectedId);
  if (index < 0) return;

  playerState.queue = uniqueTracks;
  playerState.index = index;
  playerState.history = [];
  setCurrentTrack(selectedId, shouldPlay);
}

function updateNowPlaying() {
  const track = getCurrentTrack();
  if (!track) return;

  nowPlayingTitle.textContent = track.title || "Unknown track";
  nowPlayingArtist.textContent = track.artist || "Unknown artist";
  applyArtwork(nowPlayingArt, track);
  nowPlaying.classList.toggle("is-playing", isPlaying);
  nowPlaying.querySelector("[data-player-action='shuffle']").classList.toggle("active", playerState.shuffle);
  const repeatButton = nowPlaying.querySelector("[data-player-action='repeat']");
  repeatButton.classList.toggle("active", playerState.repeat !== "off");
  repeatButton.textContent = playerState.repeat === "one" ? "↻¹" : "↻";
  repeatButton.setAttribute("aria-label", `Repeat ${playerState.repeat}`);
  nowPlaying.querySelector("[data-player-action='like']").classList.toggle("active", isLiked(track.id));
  nowPlaying.querySelector("[data-player-action='speed']").textContent = `${playerState.speed}x`;
  nowPlaying.querySelector("[data-player-action='autoplay']").classList.toggle("active", playerState.autoplay);
}

function renderQueuePanel() {
  const current = getCurrentTrack();
  const history = playerState.history.map((track) => `<button data-queue-id="${escapeHtml(track.id)}">${escapeHtml(track.title)} · ${escapeHtml(track.artist)}</button>`).join("");
  const upcoming = playerState.queue.slice(playerState.index + 1).map((track) => `<button data-queue-id="${escapeHtml(track.id)}">${escapeHtml(track.title)} · ${escapeHtml(track.artist)} <span data-remove-id="${escapeHtml(track.id)}">×</span></button>`).join("");
  queuePanel.innerHTML = `<header><strong>Queue</strong><button type="button" data-close-queue>×</button></header><p>Now playing</p><button data-queue-id="${escapeHtml(current?.id)}">${escapeHtml(current?.title || "Nothing playing")}</button><p>Up next</p>${upcoming || "<small>Nothing queued</small>"}<p>History</p>${history || "<small>No history yet</small>"}`;
}

function openQueuePanel() {
  renderQueuePanel();
  queuePanel.hidden = false;
}

function openNowPlaying() {
  if (!getCurrentTrack()) return;
  nowPlaying.hidden = false;
  document.body.classList.add("now-playing-open");
  updateNowPlaying();
}

function closeNowPlaying() {
  nowPlaying.hidden = true;
  document.body.classList.remove("now-playing-open");
}

function updateMediaSession() {
  const track = getCurrentTrack();
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window) || !track) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title || "Unknown track",
    artist: track.artist || "Unknown artist",
    album: track.album || "Pulse Music",
    artwork: track.coverImageUrl || track.coverUrl ? [{ src: resolveMediaUrl(track.coverImageUrl || track.coverUrl) }] : [],
  });
  navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
}

function playNext() {
  if (!playerState.queue.length) return;
  if (playerState.repeat === "one") {
    audio.currentTime = 0;
    playCurrentTrack();
    return;
  }

  let nextIndex;
  if (playerState.shuffle && playerState.queue.length > 1) {
    do nextIndex = Math.floor(Math.random() * playerState.queue.length);
    while (nextIndex === playerState.index);
  } else {
    nextIndex = playerState.index + 1;
    if (nextIndex >= playerState.queue.length) {
      if (playerState.repeat !== "all") {
        if (!playerState.autoplay) {
          audio.pause();
          return;
        }
        const candidates = tracks.filter((track) => !playerState.queue.some((queued) => queued.id === track.id));
        const fallback = candidates[Math.floor(Math.random() * candidates.length)] || playerState.queue[0];
        if (!fallback) return;
        playerState.queue.push(fallback);
      }
      nextIndex = 0;
      if (playerState.autoplay && playerState.repeat === "off") nextIndex = playerState.queue.length - 1;
    }
  }

  const current = playerState.queue[playerState.index];
  if (current) playerState.history.push(current);
  playerState.index = nextIndex;
  setCurrentTrack(playerState.queue[nextIndex].id, true);
}

function playPrevious() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  const previous = playerState.history.pop();
  if (previous) {
    playerState.index = playerState.queue.findIndex((track) => track.id === previous.id);
    setCurrentTrack(previous.id, true);
    return;
  }

  if (playerState.index > 0) {
    playerState.index -= 1;
    setCurrentTrack(playerState.queue[playerState.index].id, true);
  }
}

function setPlayIcons() {
  const nextIcon = isPlaying ? icon("pause") : icon("play");
  playerPlay.innerHTML = nextIcon;
  heroPlay.innerHTML = nextIcon;
  playerPlay.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  heroPlay.setAttribute("aria-label", isPlaying ? "Pause playlist" : "Play playlist");
  const overlayPlay = nowPlaying.querySelector("[data-player-action='toggle']");
  overlayPlay.textContent = isPlaying ? "❚❚" : "▶";
  overlayPlay.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  updateNowPlaying();
  updateMediaSession();
}

function setCatalogState(message, state = "empty") {
  const stateMarkup = `<p class="catalog-state ${state}">${escapeHtml(message)}</p>`;
  albumGrid.innerHTML = stateMarkup;
  trackTable.innerHTML = stateMarkup;
  quickGrid.innerHTML = "";
}

async function loadTracks() {
  setCatalogState("Loading your music library...", "loading");

  try {
    const response = await fetch(`${API_BASE_URL}/music/tracks`);

    if (!response.ok) {
      throw new Error(`Catalog request failed with ${response.status}`);
    }

    const payload = await response.json();
    tracks = Array.isArray(payload.data) ? payload.data : [];

    if (tracks.length === 0) {
      currentTrackId = null;
      setCatalogState("Your music library is empty. Upload or create a track in the backend.");
      resetPlayer();
      return;
    }

    const restored = restorePlayerState();
    if (!restored) setQueue(tracks, tracks[0].id, false);
    renderAll();
    renderPlaylists();
    renderRecentlyPlayed();
  } catch (error) {
    console.error("Unable to load tracks from the backend:", error);
    currentTrackId = null;
    resetPlayer();
    setCatalogState(
      "Unable to reach the music API. Start the backend at http://localhost:4000.",
      "error"
    );
  }
}

function resetPlayer() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  playerTitle.textContent = "No track selected";
  playerArtist.textContent = "Music library";
  durationTime.textContent = "0:00";
  elapsedTime.textContent = "0:00";
  progressInput.value = 0;
  playerCover.className = "mini-cover cover-gradient-2";
  isPlaying = false;
  setPlayIcons();
}

function setCurrentTrack(trackId, shouldPlay = true) {
  const track = tracks.find((item) => item.id === trackId);

  if (!track) {
    return;
  }

  currentTrackId = track.id;
  if (!playerState.queue.length) {
    playerState.queue = tracks;
    playerState.index = tracks.findIndex((item) => item.id === track.id);
  }
  playerTitle.textContent = track.title;
  playerArtist.textContent = track.artist;
  durationTime.textContent = formatTime(track.duration ?? track.durationSeconds);
  progressSeconds = 0;
  progressInput.value = 0;
  elapsedTime.textContent = "0:00";
  playerCover.className = "mini-cover cover-gradient-2";
  applyArtwork(playerCover, track);

  const audioUrl = resolveMediaUrl(track.audioUrl || track.audio_url);
  if (!audioUrl) {
    console.error("Track has no playable audio URL:", track);
    return;
  }

  audio.pause();
  audio.src = audioUrl;
  audio.load();

  if (shouldPlay) {
    playCurrentTrack(track);
  } else {
    isPlaying = false;
  }

  setPlayIcons();
  renderTracks();
  persistPlayerState();
}

async function registerPlay(trackId) {
  try {
    await fetch(`${API_BASE_URL}/music/tracks/${trackId}/play`, {
      method: "POST",
    });
  } catch (error) {
    console.warn("Could not record play count:", error);
  }
}

async function playCurrentTrack(track = getCurrentTrack()) {
  if (!track) return;

  try {
    await audio.play();
    registerPlay(track.id);
  } catch (error) {
    console.error("Unable to play audio:", error);
    isPlaying = false;
    setPlayIcons();
  }
}

function togglePlay() {
  const track = getCurrentTrack();
  if (!track) return;

  if (audio.paused) playCurrentTrack(track);
  else audio.pause();
}

function matchesQuery(track, query) {
  const source = [track.title, track.artist, track.album, track.genre]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return source.includes(query);
}

function matchesMood(track) {
  if (currentMood === "all") {
    return true;
  }

  const label = String(track.genre || track.mood || "").toLowerCase();
  return !label || label.includes(currentMood);
}

function getFilteredTracks() {
  const query = searchInput.value.trim().toLowerCase();
  return tracks.filter((track) => matchesMood(track) && matchesQuery(track, query));
}

function renderQuickPicks() {
  quickGrid.innerHTML = tracks
    .slice(0, 4)
    .map(
      (track) => `
        <button class="quick-card" type="button" data-track-id="${escapeHtml(track.id)}">
          <span class="mini-cover cover-gradient-2"${artworkStyle(track)}></span>
          <span>${escapeHtml(track.title)}</span>
        </button>
      `
    )
    .join("");
}

function renderAlbums() {
  const visibleTracks = getFilteredTracks();

  if (visibleTracks.length === 0) {
    albumGrid.innerHTML = '<p class="catalog-state">No tracks match the selected filter.</p>';
    return;
  }

  albumGrid.innerHTML = visibleTracks
    .map(
      (track) => `
        <article class="album-card" tabindex="0">
          <div class="album-cover cover-gradient-2"${artworkStyle(track)}></div>
          <button class="card-play" type="button" aria-label="Play ${escapeHtml(track.title)}" data-track-id="${escapeHtml(track.id)}">
            ${icon("play")}
          </button>
          <div>
            <strong class="album-title">${escapeHtml(track.title)}</strong>
            <span class="album-meta">${escapeHtml(track.artist)}${track.album ? ` - ${escapeHtml(track.album)}` : ""}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTracks() {
  const visibleTracks = getFilteredTracks();
  const rows = visibleTracks
    .map((track, visibleIndex) => {
      const isCurrent = track.id === currentTrackId;
      return `
        <button class="track-row ${isCurrent ? "playing" : ""}" type="button" data-track-id="${escapeHtml(track.id)}">
          <span>${visibleIndex + 1}</span>
          <span class="track-title-cell">
            <span class="mini-cover cover-gradient-2"${artworkStyle(track)}></span>
            <span>
              <span class="track-name">${escapeHtml(track.title)}</span>
              <span class="track-artist">${escapeHtml(track.artist)}</span>
            </span>
          </span>
          <span class="track-album">${escapeHtml(track.album || "Single")}</span>
          <span class="track-duration">${formatTime(track.duration ?? track.durationSeconds)}</span>
        </button>
      `;
    })
    .join("");

  trackTable.innerHTML = `
    <div class="track-row table-head" aria-hidden="true">
      <span>#</span>
      <span>Title</span>
      <span>Album</span>
      <span class="time-head">${icon("clock")}</span>
    </div>
    ${rows || '<p class="catalog-state">No tracks match the selected filter.</p>'}
  `;
}

function renderAll() {
  renderQuickPicks();
  renderAlbums();
  renderTracks();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentMood = button.dataset.filter;
    renderAll();
  });
});

searchInput.addEventListener("input", renderAll);

document.addEventListener("click", (event) => {
  const trackButton = event.target.closest("[data-track-id]");

  if (trackButton) {
    setQueue(getFilteredTracks(), trackButton.dataset.trackId, true);
    openNowPlaying();
  }
});

playerPlay.addEventListener("click", togglePlay);
heroPlay.addEventListener("click", () => {
  const queue = getFilteredTracks();
  if (queue.length) {
    setQueue(queue, queue[0].id, true);
    openNowPlaying();
  }
});
previousButton?.addEventListener("click", playPrevious);
nextButton?.addEventListener("click", playNext);

nowTrack?.addEventListener("click", (event) => {
  if (!event.target.closest("button")) openNowPlaying();
});
nowPlaying.addEventListener("click", (event) => {
  if (event.target === nowPlaying || event.target.closest(".now-playing-close")) return closeNowPlaying();
  const action = event.target.closest("[data-player-action]")?.dataset.playerAction;
  if (action === "toggle") togglePlay();
  if (action === "next") playNext();
  if (action === "previous") playPrevious();
  if (action === "shuffle") playerState.shuffle = !playerState.shuffle;
  if (action === "repeat") playerState.repeat = playerState.repeat === "off" ? "all" : playerState.repeat === "all" ? "one" : "off";
  if (action === "queue") openQueuePanel();
  if (action === "like") toggleLiked();
  if (action === "playlist") addCurrentTrackToPlaylist();
  if (action === "speed") {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    playerState.speed = speeds[(speeds.indexOf(playerState.speed) + 1) % speeds.length];
    audio.playbackRate = playerState.speed;
    libraryState.settings.speed = playerState.speed;
    saveLibraryState();
  }
  if (action === "autoplay") {
    playerState.autoplay = !playerState.autoplay;
    libraryState.settings.autoplay = playerState.autoplay;
    saveLibraryState();
  }
  if (action) { persistPlayerState(); updateNowPlaying(); }
});

queuePanel.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-queue]")) { queuePanel.hidden = true; return; }
  const removeId = event.target.closest("[data-remove-id]")?.dataset.removeId;
  if (removeId) {
    playerState.queue = playerState.queue.filter((track) => track.id !== removeId);
    if (playerState.index >= playerState.queue.length) playerState.index = playerState.queue.length - 1;
    persistPlayerState();
    renderQueuePanel();
    return;
  }
  const id = event.target.closest("[data-queue-id]")?.dataset.queueId;
  if (id) {
    playerState.index = playerState.queue.findIndex((track) => track.id === id);
    setCurrentTrack(id, true);
  }
});

let touchStartY = null;
playerBar?.addEventListener("touchstart", (event) => { touchStartY = event.touches[0]?.clientY; }, { passive: true });
playerBar?.addEventListener("touchend", (event) => {
  if (touchStartY - (event.changedTouches[0]?.clientY || touchStartY) > 35) openNowPlaying();
});

likeButton.addEventListener("click", () => {
  toggleLiked();
});

createPlaylistButton?.addEventListener("click", () => {
  createPlaylist();
});

progressInput.addEventListener("input", () => {
  const track = getCurrentTrack();

  if (!track) {
    return;
  }

  const duration = Number(track.duration ?? track.durationSeconds) || 0;
  progressSeconds = Math.round((Number(progressInput.value) / 100) * duration);
  elapsedTime.textContent = formatTime(progressSeconds);
  if (Number.isFinite(audio.duration)) audio.currentTime = progressSeconds;
});

nowPlayingProgress.addEventListener("input", () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = (Number(nowPlayingProgress.value) / 100) * audio.duration;
});

volumeInput?.addEventListener("input", () => {
  audio.volume = Number(volumeInput.value) / 100;
});

audio.addEventListener("loadedmetadata", () => {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  durationTime.textContent = formatTime(duration);
  nowPlayingDuration.textContent = durationTime.textContent;
});

audio.addEventListener("timeupdate", () => {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  progressSeconds = audio.currentTime || 0;
  progressInput.value = duration ? Math.round((progressSeconds / duration) * 100) : 0;
  elapsedTime.textContent = formatTime(progressSeconds);
  nowPlayingProgress.value = progressInput.value;
  nowPlayingElapsed.textContent = elapsedTime.textContent;
  persistPlayerState();
});

audio.addEventListener("play", () => {
  isPlaying = true;
  recordRecentlyPlayed(getCurrentTrack());
  renderRecentlyPlayed();
  setPlayIcons();
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  setPlayIcons();
});

audio.addEventListener("ended", () => {
  playNext();
});

document.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if (event.code === "Space") { event.preventDefault(); togglePlay(); }
  if (event.code === "ArrowRight") audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  if (event.code === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
});

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => playCurrentTrack());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
  navigator.mediaSession.setActionHandler("nexttrack", playNext);
}

audio.addEventListener("error", () => {
  console.error("Audio file could not be loaded:", audio.src, audio.error);
  isPlaying = false;
  setPlayIcons();
});

if (document.body.classList.contains("authenticated")) {
  loadTracks();
} else {
  window.addEventListener("music:authenticated", loadTracks, { once: true });
}
