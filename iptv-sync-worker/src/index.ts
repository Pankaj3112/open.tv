interface Env {
  DB: D1Database;
}

const API_BASE = "https://iptv-org.github.io/api";
const LOGOS_URL = "https://raw.githubusercontent.com/iptv-org/database/master/data/logos.csv";

interface ApiChannel {
  id: string;
  name: string;
  country: string;
  categories?: string[];
  network?: string;
  is_nsfw?: boolean;
  closed?: string;
}

interface ApiStream {
  channel: string;
  url: string;
  quality?: string;
  http_referrer?: string;
  user_agent?: string;
}

interface ApiCategory {
  id: string;
  name: string;
}

interface ApiCountry {
  code: string;
  name: string;
  flag?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function calculateLogoScore(
  feed: string,
  tags: string,
  width: string,
  height: string,
  format: string
): number {
  let score = 0;
  if (!feed) score += 1000;
  const size = (parseInt(width) || 0) * (parseInt(height) || 0);
  score += Math.min(size / 1000, 500);
  if (tags?.includes("color")) score += 100;
  if (tags?.includes("picons")) score -= 50;
  if (format === "PNG") score += 50;
  else if (format === "JPEG") score += 30;
  else if (format === "SVG") score += 20;
  return score;
}

function parseLogosCSV(csv: string): Map<string, string> {
  const lines = csv.split("\n");
  const logoMap = new Map<string, { url: string; score: number }>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 7) continue;

    const [channel, feed, tags, width, height, format, url] = values;
    if (!channel || !url) continue;

    const score = calculateLogoScore(feed, tags, width, height, format);
    const existing = logoMap.get(channel);
    if (!existing || score > existing.score) {
      logoMap.set(channel, { url, score });
    }
  }

  return new Map([...logoMap].map(([k, v]) => [k, v.url]));
}

const worker = {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    console.log("Starting IPTV data sync...");

    try {
      const [channelsRes, streamsRes, categoriesRes, countriesRes, logosRes] =
        await Promise.all([
          fetch(`${API_BASE}/channels.json`),
          fetch(`${API_BASE}/streams.json`),
          fetch(`${API_BASE}/categories.json`),
          fetch(`${API_BASE}/countries.json`),
          fetch(LOGOS_URL),
        ]);

      const [channels, streams, categories, countries, logosCSV] =
        await Promise.all([
          channelsRes.json() as Promise<ApiChannel[]>,
          streamsRes.json() as Promise<ApiStream[]>,
          categoriesRes.json() as Promise<ApiCategory[]>,
          countriesRes.json() as Promise<ApiCountry[]>,
          logosRes.text(),
        ]);

      const logoMap = parseLogosCSV(logosCSV);
      console.log(`Parsed ${logoMap.size} channel logos`);

      const safeChannels = channels.filter(
        (c) => !c.is_nsfw && !c.closed && c.id && c.country
      );

      const validStreams = streams.filter((s) => s.channel && s.url);

      console.log(
        `Fetched ${safeChannels.length} safe channels, ${validStreams.length} valid streams`
      );

      // Delete all existing data
      await env.DB.batch([
        env.DB.prepare("DELETE FROM channels"),
        env.DB.prepare("DELETE FROM streams"),
        env.DB.prepare("DELETE FROM categories"),
        env.DB.prepare("DELETE FROM countries"),
      ]);

      // Insert categories
      const categoryStmts = categories.map((c) =>
        env.DB.prepare(
          "INSERT INTO categories (category_id, name) VALUES (?, ?)"
        ).bind(c.id, c.name)
      );
      await env.DB.batch(categoryStmts);

      // Insert countries
      const countryStmts = countries.map((c) =>
        env.DB.prepare(
          "INSERT INTO countries (code, name, flag) VALUES (?, ?, ?)"
        ).bind(c.code, c.name, c.flag || "")
      );
      await env.DB.batch(countryStmts);

      // Insert channels in batches of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < safeChannels.length; i += BATCH_SIZE) {
        const batch = safeChannels.slice(i, i + BATCH_SIZE);
        const stmts = batch.map((c) =>
          env.DB.prepare(
            "INSERT INTO channels (channel_id, name, logo, country, category, network) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(
            c.id,
            c.name,
            logoMap.get(c.id) || null,
            c.country,
            c.categories?.[0] || "general",
            c.network || null
          )
        );
        await env.DB.batch(stmts);
      }

      // Insert streams in batches
      for (let i = 0; i < validStreams.length; i += BATCH_SIZE) {
        const batch = validStreams.slice(i, i + BATCH_SIZE);
        const stmts = batch.map((s) =>
          env.DB.prepare(
            "INSERT INTO streams (channel_id, url, quality, http_referrer, user_agent) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            s.channel,
            s.url,
            s.quality || null,
            s.http_referrer || null,
            s.user_agent || null
          )
        );
        await env.DB.batch(stmts);
      }

      // Update sync status
      await env.DB.prepare(
        "INSERT INTO sync_status (last_sync_at, status, channel_count) VALUES (?, ?, ?)"
      ).bind(Date.now(), "success", safeChannels.length).run();

      console.log("Sync completed successfully");
    } catch (error) {
      console.error("Sync failed:", error);
      await env.DB.prepare(
        "INSERT INTO sync_status (last_sync_at, status, error) VALUES (?, ?, ?)"
      ).bind(Date.now(), "error", String(error)).run();
    }
  },
};

export default worker;
