const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { spawnSync } = require("child_process");

const backendDir = path.resolve(__dirname, "..");
const musicDir = path.join(backendDir, "music");
const envPath = path.join(backendDir, ".env");

function loadEnv() {
  return Object.fromEntries(
    (require("fs").readFileSync(envPath, "utf8") || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
}

function cleanName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[_]+/g, " ")
    .replace(/\[(?:ncs (?:release|remake))\]/gi, "")
    .replace(/\((?:music video|official lyric video|lyrics\s*(?:amv)?|official[^)]*)\)/gi, "")
    .replace(/\b(?:4k )?music video\b/gi, "")
    .replace(/\blyrics\s*(?:amv)?\b/gi, "")
    .replace(/\bamv\b/gi, "")
    .replace(/\btiktok viral\b/gi, "")
    .replace(/\bslowed\s*reverb\b/gi, "Slowed Reverb")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,)\]])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim()
    .replace(/[\s.-]+$/g, "");
}

function deriveTrackInfo(filename) {
  const cleaned = cleanName(path.basename(filename, path.extname(filename)));
  const parts = cleaned.split(/\s+-\s+/);

  if (parts.length >= 2) {
    const [artist, ...titleParts] = parts;
    return {
      artist: cleanName(artist) || "Local library",
      title: cleanName(titleParts.join(" - ")) || cleaned,
    };
  }

  return { artist: "Local library", title: cleaned || "Untitled track" };
}

function getDurationSeconds(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
    { encoding: "utf8" }
  );
  const duration = Math.round(Number(result.stdout));

  if (result.status !== 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not read the audio duration with ffprobe");
  }

  return duration;
}

function storageName(filename, hash) {
  const extension = path.extname(filename).toLowerCase() || ".mp3";
  const base = cleanName(path.basename(filename, extension))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `tracks/${base || "track"}-${hash.slice(0, 12)}${extension}`;
}

async function request(url, key, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  }

  return response;
}

async function main() {
  const env = loadEnv();
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = env.SUPABASE_AUDIO_BUCKET || "audio";

  if (!url || !key || url.includes("your-project-ref") || key.includes("your-supabase")) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env first.");
  }

  const dryRun = process.argv.includes("--dry-run");
  const entries = await fs.readdir(musicDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(mp3|wav|ogg)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const existingResponse = await request(`${url}/rest/v1/tracks?select=title,artist`, key);
  const existing = await existingResponse.json();
  const existingKeys = new Set(existing.map((track) => `${track.artist}\u0000${track.title}`));
  const importedHashes = new Set();
  let imported = 0;
  let skipped = 0;

  for (const filename of files) {
    const filePath = path.join(musicDir, filename);
    const buffer = await fs.readFile(filePath);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const track = deriveTrackInfo(filename);
    const trackKey = `${track.artist}\u0000${track.title}`;

    if (importedHashes.has(hash) || existingKeys.has(trackKey)) {
      skipped += 1;
      console.log(`SKIP  ${filename}`);
      continue;
    }

    const duration = getDurationSeconds(filePath);
    console.log(`${dryRun ? "PLAN" : "UPLOAD"} ${track.artist} — ${track.title} (${duration}s)`);

    if (!dryRun) {
      const objectPath = storageName(filename, hash);
      await request(`${url}/storage/v1/object/${bucket}/${objectPath}`, key, {
        method: "POST",
        headers: { "Content-Type": "audio/mpeg", "x-upsert": "true" },
        body: buffer,
      });

      const audioUrl = `${url}/storage/v1/object/public/${bucket}/${objectPath}`;
      await request(`${url}/rest/v1/tracks`, key, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ ...track, duration, audio_url: audioUrl }),
      });
    }

    importedHashes.add(hash);
    existingKeys.add(trackKey);
    imported += 1;
  }

  console.log(`Done: ${imported} ${dryRun ? "tracks planned" : "tracks imported"}, ${skipped} skipped.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { deriveTrackInfo, storageName };
