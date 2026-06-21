const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/user.routes");
const musicRoutes = require("./modules/music/music.routes");
const playlistRoutes = require("./modules/playlists/playlist.routes");
const playbackRoutes = require("./modules/playback/playback.routes");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

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
        health: "GET /api/health",
        auth: {
          register: "POST /api/auth/register",
          login: "POST /api/auth/login",
          me: "GET /api/auth/me",
        },
        users: "GET /api/users",
        music: {
          tracks: "GET /api/music/tracks",
          trackDetail: "GET /api/music/tracks/:id",
          createTrack: "POST /api/music/tracks",
          uploadTrack: "POST /api/music/tracks/upload",
        },
        playlists: {
          list: "GET /api/playlists",
          create: "POST /api/playlists",
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

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/playback", playbackRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
