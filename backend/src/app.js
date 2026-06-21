const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const musicRoutes = require("./modules/music/music.routes");
const playbackRoutes = require("./modules/playback/playback.routes");
const { checkSupabaseConnection } = require("./lib/supabase");
const { asyncHandler, sendOk } = require("./shared/http");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const enableLegacyPrismaModules = process.env.ENABLE_LEGACY_PRISMA_MODULES === "true";
const userRoutes = enableLegacyPrismaModules ? require("./modules/users/user.routes") : null;
const playlistRoutes = enableLegacyPrismaModules
  ? require("./modules/playlists/playlist.routes")
  : null;

const app = express();

app.use(
  cors({
    origin: env.nodeEnv === "production" ? env.clientOrigin : true,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/api", (req, res) => {
  res.json({
    data: {
      service: "music-web-backend",
      version: "1.0.0",
      endpoints: {
        health: {
          api: "GET /api/health",
          supabase: "GET /api/health/supabase",
        },
        auth: {
          config: "GET /api/auth/config",
          register: "POST /api/auth/register",
          login: "POST /api/auth/login",
          me: "GET /api/auth/me",
        },
        music: {
          tracks: "GET /api/music/tracks",
          trackDetail: "GET /api/music/tracks/:id",
          createTrack: "POST /api/music/tracks",
          uploadTrack: "POST /api/music/tracks/upload",
        },
        playback: {
          state: "GET /api/playback/state",
          play: "POST /api/playback/play",
          pause: "POST /api/playback/pause",
        },
      },
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    data: {
      status: "ok",
      service: "music-web-backend",
      timestamp: new Date().toISOString(),
    },
  });
});

app.get(
  "/api/health/supabase",
  asyncHandler(async (req, res) => {
    sendOk(res, await checkSupabaseConnection());
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/playback", playbackRoutes);

if (enableLegacyPrismaModules) {
  app.use("/api/users", userRoutes);
  app.use("/api/playlists", playlistRoutes);
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
