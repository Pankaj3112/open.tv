"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "iptv-history";
const MAX_HISTORY = 50;

interface HistoryEntry {
  channelId: string;
  timestamp: number;
}

// Helper to safely get from localStorage (only on client)
function getStoredHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useHistory() {
  // Use lazy initialization to load from localStorage
  const [history, setHistory] = useState<HistoryEntry[]>(getStoredHistory);

  // Save to localStorage when history changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const addToHistory = useCallback((channelId: string) => {
    setHistory((prev) => {
      // Remove existing entry for this channel
      const filtered = prev.filter((entry) => entry.channelId !== channelId);

      // Add new entry at the beginning
      const newHistory = [
        { channelId, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY);

      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getHistoryChannelIds = useCallback(() => {
    return history.map((entry) => entry.channelId);
  }, [history]);

  return {
    history,
    addToHistory,
    clearHistory,
    getHistoryChannelIds,
  };
}
