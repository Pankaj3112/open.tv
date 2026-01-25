#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const API_BASE = 'https://iptv-org.github.io/api';
const DATABASE_NAME = 'iptv-db';

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function executeSql(sql) {
  const tmpFile = join(tmpdir(), `iptv-sync-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql);
  try {
    execSync(`wrangler d1 execute ${DATABASE_NAME} --remote --file="${tmpFile}"`, {
      stdio: 'inherit',
    });
  } finally {
    unlinkSync(tmpFile);
  }
}

async function main() {
  console.log('Starting IPTV data sync...');

  // Fetch all data
  console.log('Fetching data from IPTV API...');
  const [channels, streams, categories, countries] = await Promise.all([
    fetchJson(`${API_BASE}/channels.json`),
    fetchJson(`${API_BASE}/streams.json`),
    fetchJson(`${API_BASE}/categories.json`),
    fetchJson(`${API_BASE}/countries.json`),
  ]);

  // Filter channels
  const channelsWithStreams = new Set(streams.map((s) => s.channel));
  const safeChannels = channels.filter(
    (c) =>
      !c.is_nsfw &&
      !c.closed &&
      c.id &&
      c.country &&
      channelsWithStreams.has(c.id)
  );
  const validStreams = streams.filter((s) => s.channel && s.url);

  console.log(`Found ${safeChannels.length} channels, ${validStreams.length} streams`);

  // Clear existing data
  console.log('Clearing existing data...');
  executeSql(`
    DELETE FROM streams;
    DELETE FROM channels;
    DELETE FROM categories;
    DELETE FROM countries;
  `);

  // Insert categories
  console.log(`Inserting ${categories.length} categories...`);
  if (categories.length > 0) {
    const categoryValues = categories
      .map((c) => `(${escapeSQL(c.id)}, ${escapeSQL(c.name)})`)
      .join(',\n');
    executeSql(`INSERT INTO categories (category_id, name) VALUES ${categoryValues};`);
  }

  // Insert countries
  console.log(`Inserting ${countries.length} countries...`);
  if (countries.length > 0) {
    const countryValues = countries
      .map((c) => `(${escapeSQL(c.code)}, ${escapeSQL(c.name)}, ${escapeSQL(c.flag || '')})`)
      .join(',\n');
    executeSql(`INSERT INTO countries (code, name, flag) VALUES ${countryValues};`);
  }

  // Insert channels in batches
  console.log(`Inserting ${safeChannels.length} channels...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < safeChannels.length; i += BATCH_SIZE) {
    const batch = safeChannels.slice(i, i + BATCH_SIZE);
    const channelValues = batch
      .map(
        (c) =>
          `(${escapeSQL(c.id)}, ${escapeSQL(c.name)}, ${escapeSQL(c.logo || null)}, ${escapeSQL(c.country)}, ${escapeSQL(c.categories?.[0] || 'general')}, ${escapeSQL(c.network || null)})`
      )
      .join(',\n');
    executeSql(
      `INSERT INTO channels (channel_id, name, logo, country, category, network) VALUES ${channelValues};`
    );
    console.log(`  Inserted channels ${i + 1} to ${Math.min(i + BATCH_SIZE, safeChannels.length)}`);
  }

  // Insert streams in batches
  console.log(`Inserting ${validStreams.length} streams...`);
  for (let i = 0; i < validStreams.length; i += BATCH_SIZE) {
    const batch = validStreams.slice(i, i + BATCH_SIZE);
    const streamValues = batch
      .map(
        (s) =>
          `(${escapeSQL(s.channel)}, ${escapeSQL(s.url)}, ${escapeSQL(s.quality || null)}, ${escapeSQL(s.http_referrer || null)}, ${escapeSQL(s.user_agent || null)})`
      )
      .join(',\n');
    executeSql(
      `INSERT INTO streams (channel_id, url, quality, http_referrer, user_agent) VALUES ${streamValues};`
    );
    console.log(`  Inserted streams ${i + 1} to ${Math.min(i + BATCH_SIZE, validStreams.length)}`);
  }

  // Update sync status
  console.log('Updating sync status...');
  executeSql(
    `INSERT INTO sync_status (last_sync_at, status, channel_count) VALUES (${Date.now()}, 'success', ${safeChannels.length});`
  );

  console.log('Sync completed successfully!');
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
