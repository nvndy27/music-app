const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { storageName } = require("./import-music");

const backendDir = path.resolve(__dirname, "..");
const musicDir = path.join(backendDir, "music");
const envPath = path.join(backendDir, ".env");

function loadEnv() {
  return Object.fromEntries(
    require("fs")
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      })
  );
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

async function localAudioUrls(baseUrl, bucket) {
  const entries = await fs.readdir(musicDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && /\.(mp3|wav|ogg)$/i.test(entry.name));
  const urls = new Set();

  for (const file of files) {
    const content = await fs.readFile(path.join(musicDir, file.name));
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    urls.add(`${baseUrl}/storage/v1/object/public/${bucket}/${storageName(file.name, hash)}`);
  }

  return urls;
}

async function main() {
  const env = loadEnv();
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = env.SUPABASE_AUDIO_BUCKET || "audio";
  const apply = process.argv.includes("--apply");

  if (!baseUrl || !key || baseUrl.includes("your-project-ref") || key.includes("your-supabase")) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env first.");
  }

  const [localUrls, response] = await Promise.all([
    localAudioUrls(baseUrl, bucket),
    request(`${baseUrl}/rest/v1/tracks?select=id,title,artist,audio_url,created_at&order=created_at.desc`, key),
  ]);
  const tracks = await response.json();
  const keptUrls = new Set();
  const remove = tracks.filter((track) => {
    if (!localUrls.has(track.audio_url)) return true;
    if (keptUrls.has(track.audio_url)) return true;

    keptUrls.add(track.audio_url);
    return false;
  });

  console.log(`Keep: ${tracks.length - remove.length}; remove: ${remove.length} (outside library or duplicate).`);
  remove.forEach((track) => console.log(`REMOVE ${track.artist} — ${track.title}`));

  if (!apply || remove.length === 0) {
    console.log(apply ? "Nothing to remove." : "Dry run only; use --apply to delete these track records.");
    return;
  }

  for (const track of remove) {
    await request(`${baseUrl}/rest/v1/tracks?id=eq.${encodeURIComponent(track.id)}`, key, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }

  console.log(`Deleted ${remove.length} track records. Storage objects were left untouched.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
