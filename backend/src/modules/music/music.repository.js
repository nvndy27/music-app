const { supabaseFetch } = require("../../lib/supabase");

function mapTrack(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    duration: row.duration,
    audioUrl: row.audio_url,
    coverImageUrl: row.cover_image_url,
    plays: row.plays || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTrackRow(data) {
  const row = {};

  if (data.title !== undefined) row.title = data.title;
  if (data.artist !== undefined) row.artist = data.artist;
  if (data.album !== undefined) row.album = data.album || null;
  if (data.genre !== undefined) row.genre = data.genre || null;
  if (data.duration !== undefined) row.duration = data.duration;
  if (data.audioUrl !== undefined) row.audio_url = data.audioUrl || null;
  if (data.coverImageUrl !== undefined) row.cover_image_url = data.coverImageUrl || null;

  return row;
}

async function findTracks({ search } = {}) {
  const normalizedSearch = String(search || "").trim();
  const params = {
    select: "*",
    order: "created_at.desc",
  };

  if (normalizedSearch) {
    const value = normalizedSearch.replace(/[%*]/g, "");
    params.or = `(title.ilike.*${value}*,artist.ilike.*${value}*,album.ilike.*${value}*,genre.ilike.*${value}*)`;
  }

  const rows = await supabaseFetch("/rest/v1/tracks", { params });
  return rows.map(mapTrack);
}

async function findById(id) {
  const rows = await supabaseFetch("/rest/v1/tracks", {
    params: {
      select: "*",
      id: `eq.${id}`,
      limit: "1",
    },
  });

  return mapTrack(rows[0]);
}

async function create(data) {
  const rows = await supabaseFetch("/rest/v1/tracks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(toTrackRow(data)),
  });

  return mapTrack(rows[0]);
}

async function update(id, patch) {
  const rows = await supabaseFetch("/rest/v1/tracks", {
    method: "PATCH",
    params: {
      id: `eq.${id}`,
    },
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(toTrackRow(patch)),
  });

  return mapTrack(rows[0]);
}

async function remove(id) {
  await supabaseFetch("/rest/v1/tracks", {
    method: "DELETE",
    params: {
      id: `eq.${id}`,
    },
  });

  return true;
}

async function incrementPlayCount(id) {
  const rows = await supabaseFetch("/rest/v1/rpc/increment_track_plays", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ track_id: id }),
  });

  return mapTrack(rows[0]);
}

module.exports = {
  findTracks,
  findById,
  create,
  update,
  remove,
  incrementPlayCount,
};
