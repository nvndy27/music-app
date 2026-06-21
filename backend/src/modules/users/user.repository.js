const prisma = require("../../lib/prisma");

function findAll() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });
}

function findById(id) {
  return prisma.user.findUnique({
    where: { id },
  });
}

function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

function create(data) {
  return prisma.user.create({
    data: {
      displayName: data.displayName,
      email: data.email,
      password: data.password,
      role: data.role || "listener",
      avatarUrl: data.avatarUrl || null,
    },
  });
}

function update(id, patch) {
  return prisma.user.update({
    where: { id },
    data: patch,
  });
}

async function remove(id) {
  await prisma.user.delete({ where: { id } });
  return true;
}

function findLikedTracks(userId) {
  return prisma.likedTrack.findMany({
    where: { userId },
    include: { track: true },
    orderBy: { createdAt: "desc" },
  });
}

function likeTrack(userId, trackId) {
  return prisma.likedTrack.upsert({
    where: {
      userId_trackId: { userId, trackId },
    },
    update: {},
    create: { userId, trackId },
    include: { track: true },
  });
}

async function unlikeTrack(userId, trackId) {
  await prisma.likedTrack.delete({
    where: {
      userId_trackId: { userId, trackId },
    },
  });
  return true;
}

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  update,
  remove,
  findLikedTracks,
  likeTrack,
  unlikeTrack,
};
