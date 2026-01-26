const CACHE_KEY = 'stream-probe-cache';
const WORKING_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FAILED_TTL = 6 * 60 * 60 * 1000;   // 6 hours
const MAX_ENTRIES = 1000;
const SYNC_HOUR_UTC = 3;

export interface ProbeCacheEntry {
  status: 'working' | 'failed';
  workingStreamUrls: string[];
  timestamp: number;
}

type ProbeCache = Record<string, ProbeCacheEntry>;

function getLastSyncTime(): number {
  const now = new Date();
  const lastSync = new Date(now);
  lastSync.setUTCHours(SYNC_HOUR_UTC, 0, 0, 0);
  if (now < lastSync) {
    lastSync.setUTCDate(lastSync.getUTCDate() - 1);
  }
  return lastSync.getTime();
}

function loadCache(): ProbeCache {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: ProbeCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full - ignore
  }
}

export function getProbeCache(channelId: string): ProbeCacheEntry | null {
  const cache = loadCache();
  const entry = cache[channelId];
  if (!entry) return null;

  const now = Date.now();
  const lastSync = getLastSyncTime();
  const ttl = entry.status === 'working' ? WORKING_TTL : FAILED_TTL;

  // Stale if older than TTL or older than last sync
  if (entry.timestamp < lastSync || now - entry.timestamp > ttl) {
    return null;
  }

  return entry;
}

export function setProbeCache(channelId: string, entry: ProbeCacheEntry): void {
  const cache = loadCache();
  cache[channelId] = entry;

  // LRU eviction if over limit
  const entries = Object.entries(cache);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
    toRemove.forEach(([key]) => delete cache[key]);
  }

  saveCache(cache);
}

export function clearExpiredCache(): void {
  const cache = loadCache();
  const now = Date.now();
  const lastSync = getLastSyncTime();

  Object.entries(cache).forEach(([channelId, entry]) => {
    const ttl = entry.status === 'working' ? WORKING_TTL : FAILED_TTL;
    if (entry.timestamp < lastSync || now - entry.timestamp > ttl) {
      delete cache[channelId];
    }
  });

  saveCache(cache);
}
