const repository = require("./playlist.repository");
const musicService = require("../music/music.service");
const { ApiError } = require("../../shared/http");

function normalizePlaylist(playlist) {
  if (!playlist) return null;

  return {
    ...playlist,
    tracks: (playlist.tracks || []).map((row) => row.track || row),
  };
}

async function listPlaylists() {
  const playlists = repository.findAll();
  return (await playlists).map(normalizePlaylist);
}

async function getPlaylist(id) {
  const playlist = await repository.findById(id);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  return normalizePlaylist(playlist);
}

async function createPlaylist(payload, owner) {
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new ApiError(400, "Playlist name is required");
  }

  if (!owner?.id) {
    throw new ApiError(401, "Authentication is required to create playlists");
  }

  const trackIds = Array.isArray(payload.trackIds) ? payload.trackIds : [];

  for (const trackId of trackIds) {
    await musicService.getTrack(trackId);
  }

  const playlist = repository.create({
    name,
    description: payload.description,
    coverImageUrl: payload.coverImageUrl,
    userId: owner.id,
    trackIds,
  });

  return normalizePlaylist(await playlist);
}

async function updatePlaylist(id, payload, actor) {
  const playlist = await repository.findById(id);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.userId && actor?.id !== playlist.userId && actor?.role !== "admin") {
    throw new ApiError(403, "You can only update your own playlist");
  }

  const patch = {};

  if (payload.name !== undefined) patch.name = String(payload.name).trim();
  if (payload.description !== undefined) patch.description = String(payload.description || "");
  if (payload.coverImageUrl !== undefined) patch.coverImageUrl = payload.coverImageUrl || null;

  if (Array.isArray(payload.trackIds)) {
    for (const trackId of payload.trackIds) {
      await musicService.getTrack(trackId);
    }

    await repository.update(id, patch);
    return normalizePlaylist(await repository.replaceTracks(id, payload.trackIds));
  }

  return normalizePlaylist(await repository.update(id, patch));
}

async function addTrack(id, trackId, actor) {
  const playlist = await repository.findById(id);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.userId && actor?.id !== playlist.userId && actor?.role !== "admin") {
    throw new ApiError(403, "You can only update your own playlist");
  }

  await musicService.getTrack(trackId);

  return normalizePlaylist(await repository.addTrack(id, trackId));
}

async function removeTrack(id, trackId, actor) {
  const playlist = await repository.findById(id);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.userId && actor?.id !== playlist.userId && actor?.role !== "admin") {
    throw new ApiError(403, "You can only update your own playlist");
  }

  try {
    return normalizePlaylist(await repository.removeTrack(id, trackId));
  } catch (error) {
    throw new ApiError(404, "Track is not in playlist");
  }
}

async function deletePlaylist(id, actor) {
  const playlist = await repository.findById(id);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.userId && actor?.id !== playlist.userId && actor?.role !== "admin") {
    throw new ApiError(403, "You can only delete your own playlist");
  }

  await repository.remove(id);
  return { id };
}

module.exports = {
  listPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  addTrack,
  removeTrack,
  deletePlaylist,
};
