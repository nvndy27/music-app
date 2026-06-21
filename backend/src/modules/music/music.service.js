const repository = require("./music.repository");
const env = require("../../config/env");
const { supabaseFetch, getPublicStorageUrl } = require("../../lib/supabase");
const { ApiError } = require("../../shared/http");

const AUDIO_MIME_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]);
const COVER_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeFileName(name) {
  const fallback = `file-${Date.now()}`;
  const clean = String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return clean || fallback;
}

async function uploadStorageFile(bucket, folder, file) {
  const path = `${folder}/${Date.now()}-${safeFileName(file.originalname)}`;

  await supabaseFetch(`/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": file.mimetype,
      "x-upsert": "false",
    },
    body: file.buffer,
  });

  return getPublicStorageUrl(bucket, path);
}

function normalizeTrackPayload(payload, partial = false) {
  const data = {};

  if (!partial || payload.title !== undefined) {
    data.title = String(payload.title || "").trim();
  }

  if (!partial || payload.artist !== undefined) {
    data.artist = String(payload.artist || "").trim();
  }

  if (payload.album !== undefined) {
    data.album = String(payload.album || "").trim();
  }

  if (payload.genre !== undefined) {
    data.genre = String(payload.genre || "").trim();
  }

  if (payload.durationSeconds !== undefined) {
    data.duration = Number(payload.durationSeconds);
  }

  if (payload.duration !== undefined) {
    data.duration = Number(payload.duration);
  }

  if (payload.audioUrl !== undefined) {
    data.audioUrl = payload.audioUrl || null;
  }

  if (payload.coverUrl !== undefined) {
    data.coverImageUrl = payload.coverUrl || null;
  }

  if (payload.coverImageUrl !== undefined) {
    data.coverImageUrl = payload.coverImageUrl || null;
  }

  return data;
}

async function listTracks(query) {
  return repository.findTracks(query);
}

async function getTrack(id) {
  const track = await repository.findById(id);

  if (!track) {
    throw new ApiError(404, "Track not found");
  }

  return track;
}

async function createTrack(payload) {
  const data = normalizeTrackPayload(payload);

  if (!data.title || !data.artist || !Number.isFinite(data.duration)) {
    throw new ApiError(400, "title, artist, and duration are required");
  }

  if (data.duration <= 0) {
    throw new ApiError(400, "duration must be greater than 0");
  }

  return repository.create(data);
}

async function uploadTrack(payload, files) {
  const audioFile = files?.audio?.[0];
  const coverFile = files?.cover?.[0];

  if (!audioFile) {
    throw new ApiError(400, "audio file is required");
  }

  if (!AUDIO_MIME_TYPES.has(audioFile.mimetype)) {
    throw new ApiError(400, "audio must be an mp3, wav, or ogg file");
  }

  if (coverFile && !COVER_MIME_TYPES.has(coverFile.mimetype)) {
    throw new ApiError(400, "cover must be a jpeg, png, or webp image");
  }

  const duration = Number(payload.duration || payload.durationSeconds);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ApiError(400, "duration is required and must be greater than 0");
  }

  const audioUrl = await uploadStorageFile(env.supabaseAudioBucket, "tracks", audioFile);
  const coverImageUrl = coverFile
    ? await uploadStorageFile(env.supabaseCoverBucket, "covers", coverFile)
    : payload.coverImageUrl || payload.coverUrl || null;

  return createTrack({
    title: payload.title,
    artist: payload.artist,
    album: payload.album,
    duration,
    audioUrl,
    coverImageUrl,
  });
}

async function updateTrack(id, payload) {
  await getTrack(id);
  const data = normalizeTrackPayload(payload, true);

  if (data.duration !== undefined && data.duration <= 0) {
    throw new ApiError(400, "duration must be greater than 0");
  }

  return repository.update(id, data);
}

async function deleteTrack(id) {
  const removed = await repository.remove(id);

  if (!removed) {
    throw new ApiError(404, "Track not found");
  }

  return { id };
}

async function increasePlayCount(id) {
  let track = null;

  try {
    track = await repository.incrementPlayCount(id);
  } catch (error) {
    track = null;
  }

  if (!track) {
    throw new ApiError(404, "Track not found");
  }

  return track;
}

module.exports = {
  listTracks,
  getTrack,
  createTrack,
  uploadTrack,
  updateTrack,
  deleteTrack,
  increasePlayCount,
};
