require("dotenv").config();

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  adminUploadKey: process.env.ADMIN_UPLOAD_KEY || "dev-admin-key",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseAudioBucket: process.env.SUPABASE_AUDIO_BUCKET || "audio",
  supabaseCoverBucket: process.env.SUPABASE_COVER_BUCKET || "covers",
};

module.exports = env;
