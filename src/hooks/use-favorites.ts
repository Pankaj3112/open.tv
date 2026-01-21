"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "iptv-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  // Save to localStorage when favorites change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      if (prev.includes(channelId)) return prev;
      return [...prev, channelId];
    });
  }, []);

  const removeFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => prev.filter((id) => id !== channelId));
  }, []);

  const toggleFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      if (prev.includes(channelId)) {
        return prev.filter((id) => id !== channelId);
      }
      return [...prev, channelId];
    });
  }, []);

  const isFavorite = useCallback(
    (channelId: string) => favorites.includes(channelId),
    [favorites]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearFavorites,
  };
}
