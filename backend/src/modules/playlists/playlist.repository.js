const prisma = require("../../lib/prisma");

const playlistInclude = {
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  tracks: {
    include: { track: true },
    orderBy: { order: "asc" },
  },
};

function findAll() {
  return prisma.playlist.findMany({
    include: playlistInclude,
    orderBy: { createdAt: "desc" },
  });
}

function findById(id) {
  return prisma.playlist.findUnique({
    where: { id },
    include: playlistInclude,
  });
}

function create(data) {
  return prisma.playlist.create({
    data: {
      name: data.name,
      description: data.description || null,
      coverImageUrl: data.coverImageUrl || null,
      userId: data.userId,
      tracks: {
        create: (data.trackIds || []).map((trackId, index) => ({
          trackId,
          order: index,
        })),
      },
    },
    include: playlistInclude,
  });
}

function update(id, patch) {
  return prisma.playlist.update({
    where: { id },
    data: patch,
    include: playlistInclude,
  });
}

async function replaceTracks(id, trackIds) {
  return prisma.$transaction(async (tx) => {
    await tx.playlistTrack.deleteMany({ where: { playlistId: id } });
    await tx.playlistTrack.createMany({
      data: trackIds.map((trackId, index) => ({
        playlistId: id,
        trackId,
        order: index,
      })),
      skipDuplicates: true,
    });

    return tx.playlist.findUnique({
      where: { id },
      include: playlistInclude,
    });
  });
}

async function addTrack(id, trackId) {
  const count = await prisma.playlistTrack.count({
    where: { playlistId: id },
  });

  await prisma.playlistTrack.upsert({
    where: {
      playlistId_trackId: {
        playlistId: id,
        trackId,
      },
    },
    update: {},
    create: {
      playlistId: id,
      trackId,
      order: count,
    },
  });

  return findById(id);
}

async function removeTrack(id, trackId) {
  await prisma.playlistTrack.delete({
    where: {
      playlistId_trackId: {
        playlistId: id,
        trackId,
      },
    },
  });

  return findById(id);
}

async function remove(id) {
  await prisma.playlist.delete({ where: { id } });
  return true;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  replaceTracks,
  addTrack,
  removeTrack,
  remove,
};
