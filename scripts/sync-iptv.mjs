#!/usr/bin/env node

import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const API_BASE = "https://iptv-org.github.io/api";
const LOGOS_CSV_URL =
  "https://raw.githubusercontent.com/iptv-org/database/master/data/logos.csv";
const DATABASE_NAME = "opentv-db";

// Check for --local flag
const IS_LOCAL = process.argv.includes("--local");
const D1_FLAG = IS_LOCAL ? "--local" : "--remote";

// D1 limits: Keep transactions small to avoid timeouts
const ROWS_PER_TRANSACTION = 2000; // ~2000 rows per transaction
const ROWS_PER_INSERT = 100; // 100 rows per bulk INSERT statement

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  return res.text();
}

function parseCSVLine(line) {
  const result = [];
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

function calculateLogoScore(feed, tags, width, height, format) {
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

function parseLogosCSV(csv) {
  const lines = csv.split("\n");
  const logoMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
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

function escapeSQL(str) {
  if (str === null || str === undefined) return "NULL";
  return `'${String(str).replace(/'/g, "''")}'`;
}

function generateBulkInsert(table, columns, rows, chunkSize = 100) {
  const statements = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk
      .map((row) => `(${columns.map((col) => escapeSQL(row[col])).join(", ")})`)
      .join(",\n");

    statements.push(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};`,
    );
  }

  return statements;
}

function executeSqlFile(sqlContent, description) {
  const tmpFile = join(
    tmpdir(),
    `iptv-sync-${Date.now()}-${Math.random()}.sql`,
  );
  writeFileSync(tmpFile, sqlContent);

  try {
    console.log(`  Executing: ${description}...`);
    execSync(
      `npx wrangler d1 execute ${DATABASE_NAME} ${D1_FLAG} --yes --file="${tmpFile}"`,
      {
        stdio: "pipe", // Suppress wrangler output
      },
    );
    console.log(`  ✓ ${description}`);
  } catch (error) {
    console.error(`  ✗ Failed: ${description}`);
    throw error;
  } finally {
    unlinkSync(tmpFile);
  }
}

async function main() {
  console.log(`Starting IPTV data sync (${IS_LOCAL ? "LOCAL" : "REMOTE"})...`);
  const startTime = Date.now();

  // Fetch all data in parallel
  console.log("Fetching data from IPTV API...");
  const fetchStart = Date.now();
  const [channels, streams, categories, countries, logosText] =
    await Promise.all([
      fetchJson(`${API_BASE}/channels.json`),
      fetchJson(`${API_BASE}/streams.json`),
      fetchJson(`${API_BASE}/categories.json`),
      fetchJson(`${API_BASE}/countries.json`),
      fetchText(LOGOS_CSV_URL),
    ]);
  console.log(
    `✓ Fetched data in ${((Date.now() - fetchStart) / 1000).toFixed(1)}s`,
  );

  // Parse logos CSV into a map
  console.log("Parsing logos data...");
  const logoMap = parseLogosCSV(logosText);
  console.log(`✓ Found logos for ${logoMap.size} channels`);

  // Filter channels
  const channelsWithStreams = new Set(streams.map((s) => s.channel));
  const safeChannels = channels.filter(
    (c) =>
      !c.is_nsfw &&
      !c.closed &&
      c.id &&
      c.country &&
      channelsWithStreams.has(c.id),
  );
  const validStreams = streams.filter((s) => s.channel && s.url);

  console.log(
    `✓ Found ${safeChannels.length} channels, ${validStreams.length} streams`,
  );

  // Step 1: Clear existing data and insert small tables (categories, countries)
  console.log(
    "\n[1/4] Clearing database and inserting categories/countries...",
  );
  const initStatements = [
    "DELETE FROM streams;",
    "DELETE FROM channels;",
    "DELETE FROM categories;",
    "DELETE FROM countries;",
  ];

  // Add categories
  const categoryRows = categories.map((c) => ({
    category_id: c.id,
    name: c.name,
  }));
  initStatements.push(
    ...generateBulkInsert(
      "categories",
      ["category_id", "name"],
      categoryRows,
      ROWS_PER_INSERT,
    ),
  );

  // Add countries
  const countryRows = countries.map((c) => ({
    code: c.code,
    name: c.name,
    flag: c.flag || "",
  }));
  initStatements.push(
    ...generateBulkInsert(
      "countries",
      ["code", "name", "flag"],
      countryRows,
      ROWS_PER_INSERT,
    ),
  );

  executeSqlFile(
    initStatements.join("\n"),
    "Cleared DB and inserted categories/countries",
  );

  // Step 2: Insert channels in batches
  console.log("\n[2/4] Inserting channels...");
  const channelRows = safeChannels.map((c) => ({
    channel_id: c.id,
    name: c.name,
    logo: logoMap.get(c.id) || null,
    country: c.country,
    category: c.categories?.[0] || "general",
    network: c.network || null,
  }));

  const channelBatches = Math.ceil(channelRows.length / ROWS_PER_TRANSACTION);
  for (let i = 0; i < channelRows.length; i += ROWS_PER_TRANSACTION) {
    const batch = channelRows.slice(i, i + ROWS_PER_TRANSACTION);
    const batchNum = Math.floor(i / ROWS_PER_TRANSACTION) + 1;

    const batchStatements = [
      ...generateBulkInsert(
        "channels",
        ["channel_id", "name", "logo", "country", "category", "network"],
        batch,
        ROWS_PER_INSERT,
      ),
    ];

    executeSqlFile(
      batchStatements.join("\n"),
      `Channels batch ${batchNum}/${channelBatches} (${batch.length} channels)`,
    );
  }

  // Step 3: Insert streams in batches
  console.log("\n[3/4] Inserting streams...");
  const streamRows = validStreams.map((s) => ({
    channel_id: s.channel,
    url: s.url,
    quality: s.quality || null,
    http_referrer: s.http_referrer || null,
    user_agent: s.user_agent || null,
  }));

  const streamBatches = Math.ceil(streamRows.length / ROWS_PER_TRANSACTION);
  for (let i = 0; i < streamRows.length; i += ROWS_PER_TRANSACTION) {
    const batch = streamRows.slice(i, i + ROWS_PER_TRANSACTION);
    const batchNum = Math.floor(i / ROWS_PER_TRANSACTION) + 1;

    const batchStatements = [
      ...generateBulkInsert(
        "streams",
        ["channel_id", "url", "quality", "http_referrer", "user_agent"],
        batch,
        ROWS_PER_INSERT,
      ),
    ];

    executeSqlFile(
      batchStatements.join("\n"),
      `Streams batch ${batchNum}/${streamBatches} (${batch.length} streams)`,
    );
  }

  // Step 4: Update sync status
  console.log("\n[4/4] Updating sync status...");
  const syncStatements = [
    `INSERT INTO sync_status (last_sync_at, status, channel_count) VALUES (${Date.now()}, 'success', ${safeChannels.length});`,
  ];
  executeSqlFile(syncStatements.join("\n"), "Updated sync status");

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Sync completed successfully in ${totalTime}s!`);
  console.log(`  - ${safeChannels.length} channels`);
  console.log(`  - ${validStreams.length} streams`);
  console.log(`  - ${categories.length} categories`);
  console.log(`  - ${countries.length} countries`);
}

main().catch((err) => {
  console.error("\n❌ Sync failed:", err.message);
  process.exit(1);
});
