"use client";

import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ChannelGrid } from "@/components/channel-grid";
import { VideoPlayer } from "@/components/video-player";
import { FilterChips } from "@/components/filter-chips";
import { useFilters } from "@/hooks/use-filters";
import { useFavorites } from "@/hooks/use-favorites";
import { useHistory } from "@/hooks/use-history";
import { useCategories } from "@/hooks/use-categories";
import { useCountries } from "@/hooks/use-countries";
import { useChannels } from "@/hooks/use-channels";
import { useChannel } from "@/hooks/use-channel";
import { useStreams } from "@/hooks/use-streams";
import { useChannelsByIds } from "@/hooks/use-channels-by-ids";
import { useMemo, useState, useCallback, Suspense } from "react";

function HomeContent() {
  const { filters, updateFilters, clearFilters } = useFilters();
  const { favorites, toggleFavorite, clearFavorites } = useFavorites();
  const { addToHistory, getHistoryChannelIds, clearHistory, history } =
    useHistory();

  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [favoritesSort, setFavoritesSort] = useState<
    "recent" | "most-watched" | "alphabetical"
  >("recent");

  const [historyTimeFilter, setHistoryTimeFilter] = useState<
    "today" | "week" | "all"
  >("all");

  const sidebarMode = showFavorites
    ? "favorites"
    : showHistory
      ? "history"
      : "browse";

  // Fetch reference data
  const { categories: categoriesData } = useCategories();
  const { countries: countriesData } = useCountries();

  // Fetch channels with pagination
  const {
    channels,
    isLoading: channelsLoading,
    hasMore,
    loadMore,
  } = useChannels({
    search: filters.search || undefined,
    countries: filters.countries.length ? filters.countries : undefined,
    categories: filters.categories.length ? filters.categories : undefined,
  });

  // Fetch favorite channels
  const { channels: favoriteChannels, isLoading: favoritesLoading } =
    useChannelsByIds(showFavorites ? favorites : []);

  // Fetch history channels
  const historyChannelIds = getHistoryChannelIds();
  const { channels: historyChannels, isLoading: historyLoading } =
    useChannelsByIds(showHistory ? historyChannelIds : []);

  // Fetch current playing channel and stream
  const { channel: playingChannel } = useChannel(filters.playing);
  const { streams: playingStreams } = useStreams(filters.playing);

  // Transform data for components
  const categoryOptions = useMemo(
    () =>
      categoriesData.map((c) => ({
        id: c.category_id,
        label: c.name,
      })),
    [categoriesData],
  );

  const countryOptions = useMemo(
    () =>
      countriesData.map((c) => ({
        id: c.code,
        label: c.name,
        icon: c.flag,
      })),
    [countriesData],
  );

  const countryFlags = useMemo(
    () =>
      countriesData.reduce(
        (acc, c) => {
          acc[c.code] = c.flag;
          return acc;
        },
        {} as Record<string, string>,
      ),
    [countriesData],
  );

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Determine which channels to display
  const displayChannels = useMemo(() => {
    if (showFavorites) {
      if (favorites.length === 0) return [];

      const filtered = [...favoriteChannels];

      if (favoritesSort === "alphabetical") {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else if (favoritesSort === "recent") {
        const favoriteOrder = favorites.reduce(
          (acc, id, index) => {
            acc[id] = index;
            return acc;
          },
          {} as Record<string, number>,
        );
        filtered.sort(
          (a, b) =>
            (favoriteOrder[b.channel_id] ?? 0) -
            (favoriteOrder[a.channel_id] ?? 0),
        );
      } else if (favoritesSort === "most-watched") {
        const watchCounts = history.reduce(
          (acc, entry) => {
            acc[entry.channelId] = (acc[entry.channelId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        filtered.sort(
          (a, b) =>
            (watchCounts[b.channel_id] || 0) - (watchCounts[a.channel_id] || 0),
        );
      }

      return filtered;
    }

    if (showHistory) {
      if (history.length === 0) return [];

      let filtered = [...historyChannels];

      const filteredHistoryEntries = history.filter((entry) => {
        if (historyTimeFilter === "today") return entry.timestamp >= oneDayAgo;
        if (historyTimeFilter === "week") return entry.timestamp >= oneWeekAgo;
        return true;
      });

      const filteredChannelIds = new Set(
        filteredHistoryEntries.map((e) => e.channelId),
      );
      filtered = filtered.filter((channel) =>
        filteredChannelIds.has(channel.channel_id),
      );

      const timeOrder = filteredHistoryEntries.reduce(
        (acc, entry, index) => {
          acc[entry.channelId] = index;
          return acc;
        },
        {} as Record<string, number>,
      );
      filtered.sort(
        (a, b) =>
          (timeOrder[a.channel_id] ?? Infinity) -
          (timeOrder[b.channel_id] ?? Infinity),
      );

      return filtered;
    }

    return channels;
  }, [
    showFavorites,
    favoriteChannels,
    showHistory,
    historyChannels,
    channels,
    favoritesSort,
    favorites,
    history,
    historyTimeFilter,
    oneDayAgo,
    oneWeekAgo,
  ]);

  const filterChips = useMemo(() => {
    const chips: Array<{
      type: "category" | "country";
      id: string;
      label: string;
      icon?: string;
    }> = [];

    filters.categories.forEach((id) => {
      const cat = categoriesData.find((c) => c.category_id === id);
      if (cat) chips.push({ type: "category", id, label: cat.name });
    });

    filters.countries.forEach((id) => {
      const country = countriesData.find((c) => c.code === id);
      if (country)
        chips.push({
          type: "country",
          id,
          label: country.name,
          icon: country.flag,
        });
    });

    return chips;
  }, [filters, categoriesData, countriesData]);

  const activeFilterCount =
    filters.categories.length +
    filters.countries.length +
    (filters.search ? 1 : 0);

  const handlePlay = useCallback(
    (channelId: string) => {
      updateFilters({ playing: channelId });
      addToHistory(channelId);
    },
    [updateFilters, addToHistory],
  );

  const handleClosePlayer = useCallback(() => {
    updateFilters({ playing: null });
  }, [updateFilters]);

  const handleRemoveChip = useCallback(
    (type: "category" | "country", id: string) => {
      if (type === "category") {
        updateFilters({
          categories: filters.categories.filter((c) => c !== id),
        });
      } else {
        updateFilters({
          countries: filters.countries.filter((c) => c !== id),
        });
      }
    },
    [filters, updateFilters],
  );

  const handleShowFavorites = (show: boolean) => {
    setShowFavorites(show);
    if (show) setShowHistory(false);
  };

  const handleShowHistory = (show: boolean) => {
    setShowHistory(show);
    if (show) setShowFavorites(false);
  };

  const handleBackToBrowse = useCallback(() => {
    setShowFavorites(false);
    setShowHistory(false);
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
  }, [clearFavorites]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);

  const isLoading = useMemo(() => {
    if (showFavorites) {
      return favorites.length > 0 && favoritesLoading;
    }
    if (showHistory) {
      return historyChannelIds.length > 0 && historyLoading;
    }
    return channelsLoading;
  }, [showFavorites, showHistory, favorites.length, favoritesLoading, historyChannelIds.length, historyLoading, channelsLoading]);

  // Map channel data to expected format
  const mappedChannels = useMemo(() => {
    return displayChannels.map((ch) => ({
      channelId: ch.channel_id,
      name: ch.name,
      logo: ch.logo ?? undefined,
      country: ch.country,
      category: ch.category,
      network: ch.network ?? undefined,
    }));
  }, [displayChannels]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        search={filters.search}
        onSearchChange={(search) => updateFilters({ search })}
        categories={categoryOptions}
        selectedCategories={filters.categories}
        onCategoriesChange={(categories) => updateFilters({ categories })}
        countries={countryOptions}
        selectedCountries={filters.countries}
        onCountriesChange={(countries) => updateFilters({ countries })}
        showFavorites={showFavorites}
        onShowFavoritesChange={handleShowFavorites}
        showHistory={showHistory}
        onShowHistoryChange={handleShowHistory}
        activeFilterCount={activeFilterCount}
      />

      <div className="flex">
        <Sidebar
          className="hidden lg:flex w-72 shrink-0 border-r h-[calc(100vh-3.5rem)] sticky top-14"
          mode={sidebarMode}
          search={filters.search}
          onSearchChange={(search) => updateFilters({ search })}
          categories={categoryOptions}
          selectedCategories={filters.categories}
          onCategoriesChange={(categories) => updateFilters({ categories })}
          countries={countryOptions}
          selectedCountries={filters.countries}
          onCountriesChange={(countries) => updateFilters({ countries })}
          showFavorites={showFavorites}
          onShowFavoritesChange={handleShowFavorites}
          showHistory={showHistory}
          onShowHistoryChange={handleShowHistory}
          onBackToBrowse={handleBackToBrowse}
          favoriteCount={favorites.length}
          historyCount={history.length}
          favoritesSort={favoritesSort}
          onFavoritesSortChange={setFavoritesSort}
          historyTimeFilter={historyTimeFilter}
          onHistoryTimeFilterChange={setHistoryTimeFilter}
          onClearFavorites={handleClearFavorites}
          onClearHistory={handleClearHistory}
        />

        <main className="flex-1 p-4 lg:p-6">
          {filters.playing && playingChannel && (
            <div className="mb-6">
              <VideoPlayer
                channelName={playingChannel.name}
                stream={playingStreams?.[0] ? {
                  url: playingStreams[0].url,
                  quality: playingStreams[0].quality ?? undefined,
                  httpReferrer: playingStreams[0].http_referrer ?? undefined,
                  userAgent: playingStreams[0].user_agent ?? undefined,
                } : null}
                onClose={handleClosePlayer}
              />
            </div>
          )}

          <div className="mb-4">
            <FilterChips
              chips={filterChips}
              onRemove={handleRemoveChip}
              onClearAll={clearFilters}
            />
          </div>

          <ChannelGrid
            channels={mappedChannels}
            countryFlags={countryFlags}
            playingChannelId={filters.playing ?? undefined}
            favorites={favorites}
            onPlay={handlePlay}
            onToggleFavorite={toggleFavorite}
            isLoading={isLoading}
            hasMore={hasMore && !showFavorites && !showHistory}
            onLoadMore={handleLoadMore}
            mode={sidebarMode}
          />
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
