const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const fixes = [
  {
    from: { artist: "Local library", title: "VØJ x Narvent Memory Reboot (Slowed)" },
    to: { artist: "VØJ, Narvent", title: "Memory Reboot (Slowed)" },
  },
  {
    from: { artist: "alone with you", title: "[ LONOWN , Baby Jane ] Ultra Slowed & Reverb" },
    to: { artist: "LONOWN, Baby Jane", title: "alone with you (Ultra Slowed & Reverb)" },
  },
];

async function request(url, options = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(url, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...options.headers },
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response;
}

async function main() {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!baseUrl || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase configuration in backend/.env");

  for (const fix of fixes) {
    const query = new URLSearchParams({
      artist: `eq.${fix.from.artist}`,
      title: `eq.${fix.from.title}`,
    });
    const response = await request(`${baseUrl}/rest/v1/tracks?${query}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fix.to),
    });
    const updated = await response.json();
    console.log(`${updated.length ? "UPDATED" : "SKIPPED"}: ${fix.to.artist} — ${fix.to.title}`);
  }
}

main().catch((error) => {
  console.error(`Metadata repair failed: ${error.message}`);
  process.exitCode = 1;
});
