-- Channels table
CREATE TABLE channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo TEXT,
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  network TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_channels_country ON channels(country);
CREATE INDEX idx_channels_category ON channels(category);
CREATE INDEX idx_channels_category_country ON channels(category, country);
CREATE INDEX idx_channels_name ON channels(name);

-- Streams table
CREATE TABLE streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  url TEXT NOT NULL,
  quality TEXT,
  http_referrer TEXT,
  user_agent TEXT
);

CREATE INDEX idx_streams_channel_id ON streams(channel_id);

-- Categories table
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

-- Countries table
CREATE TABLE countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  flag TEXT
);

-- Sync status table
CREATE TABLE sync_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_sync_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  channel_count INTEGER,
  error TEXT
);
