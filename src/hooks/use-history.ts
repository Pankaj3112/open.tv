"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "iptv-history";
const MAX_HISTORY = 50;

interface HistoryEntry {
  channelId: string;
  timestamp: number;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    }
  }, []);

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
