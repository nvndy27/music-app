const bcrypt = require("bcryptjs");
const repository = require("./user.repository");
const { ApiError } = require("../../shared/http");

function sanitize(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function sanitizeMany(users) {
  return users.map(sanitize);
}

async function findById(id) {
  return sanitize(await repository.findById(id));
}

async function findPrivateById(id) {
  return repository.findById(id);
}

async function findPrivateByEmail(email) {
  return repository.findByEmail(email);
}

async function listUsers() {
  return sanitizeMany(await repository.findAll());
}

async function createUser(payload) {
  const displayName = String(payload.displayName || payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (!displayName || !email || !password) {
    throw new ApiError(400, "displayName, email, and password are required");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  if (await repository.findByEmail(email)) {
    throw new ApiError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repository.create({
    displayName,
    email,
    password: passwordHash,
    role: payload.role === "admin" ? "admin" : "listener",
  });

  return sanitize(user);
}

async function updateUser(id, payload, actor) {
  const existingUser = await repository.findById(id);

  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  if (actor && actor.id !== id && actor.role !== "admin") {
    throw new ApiError(403, "You can only update your own account");
  }

  const patch = {};

  if (payload.name !== undefined) {
    patch.displayName = String(payload.name).trim();
  }

  if (payload.displayName !== undefined) {
    patch.displayName = String(payload.displayName).trim();
  }

  if (payload.avatarUrl !== undefined) {
    patch.avatarUrl = payload.avatarUrl || null;
  }

  if (payload.isActive !== undefined && actor?.role === "admin") {
    patch.isActive = Boolean(payload.isActive);
  }

  if (payload.role !== undefined && actor?.role === "admin") {
    patch.role = payload.role === "admin" ? "admin" : "listener";
  }

  return sanitize(await repository.update(id, patch));
}

async function deleteUser(id, actor) {
  if (actor && actor.id !== id && actor.role !== "admin") {
    throw new ApiError(403, "You can only delete your own account");
  }

  const removed = await repository.remove(id);

  if (!removed) {
    throw new ApiError(404, "User not found");
  }

  return { id };
}

async function listLikedTracks(id) {
  await ensureUserExists(id);
  const rows = await repository.findLikedTracks(id);
  return rows.map((row) => row.track);
}

async function likeTrack(id, trackId, actor) {
  if (actor && actor.id !== id && actor.role !== "admin") {
    throw new ApiError(403, "You can only update your own liked tracks");
  }

  await ensureUserExists(id);
  const row = await repository.likeTrack(id, trackId);
  return row.track;
}

async function unlikeTrack(id, trackId, actor) {
  if (actor && actor.id !== id && actor.role !== "admin") {
    throw new ApiError(403, "You can only update your own liked tracks");
  }

  await ensureUserExists(id);

  try {
    await repository.unlikeTrack(id, trackId);
  } catch (error) {
    throw new ApiError(404, "Liked track not found");
  }

  return { userId: id, trackId };
}

async function ensureUserExists(id) {
  const user = await repository.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

module.exports = {
  sanitize,
  findById,
  findPrivateById,
  findPrivateByEmail,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listLikedTracks,
  likeTrack,
  unlikeTrack,
};
