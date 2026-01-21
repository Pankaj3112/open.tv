"use client";

import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ChannelGrid } from "@/components/channel-grid";
import { VideoPlayer } from "@/components/video-player";
import { FilterChips } from "@/components/filter-chips";
import { useFilters } from "@/hooks/use-filters";
import { useFavorites } from "@/hooks/use-favorites";
import { useHistory } from "@/hooks/use-history";
import { useMemo, useState, useCallback, Suspense } from "react";

function HomeContent() {
  const { filters, updateFilters, clearFilters } = useFilters();
  const { favorites, toggleFavorite, clearFavorites } = useFavorites();
  const { addToHistory, getHistoryChannelIds, clearHistory, history } =
    useHistory();

  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Favorites controls
  const [favoritesSort, setFavoritesSort] = useState<
    "recent" | "most-watched" | "alphabetical"
  >("recent");

  // History controls
  const [historyTimeFilter, setHistoryTimeFilter] = useState<
    "today" | "week" | "all"
  >("all");

  // Calculate sidebar mode
  const sidebarMode = showFavorites
    ? "favorites"
    : showHistory
      ? "history"
      : "browse";

  // Fetch reference data
  const categoriesData = useQuery(api.categories.list) ?? [];
  const countriesData = useQuery(api.countries.list) ?? [];

  // Fetch channels with pagination
  const {
    results: channels,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.channels.list,
    {
      search: filters.search || undefined,
      countries: filters.countries.length ? filters.countries : undefined,
      categories: filters.categories.length ? filters.categories : undefined,
    },
    { initialNumItems: 48 },
  );

  // Fetch favorite channels if showing favorites
  const favoriteChannels = useQuery(
    api.channels.getByIds,
    showFavorites && favorites.length > 0 ? { channelIds: favorites } : "skip",
  );

  // Fetch history channels if showing history
  const historyChannelIds = getHistoryChannelIds();
  const historyChannels = useQuery(
    api.channels.getByIds,
    showHistory && historyChannelIds.length > 0
      ? { channelIds: historyChannelIds }
      : "skip",
  );

  // Fetch current playing channel and stream
  const playingChannel = useQuery(
    api.channels.getById,
    filters.playing ? { channelId: filters.playing } : "skip",
  );
  const playingStream = useQuery(
    api.streams.getByChannelId,
    filters.playing ? { channelId: filters.playing } : "skip",
  );

  // Transform data for components
  const categoryOptions = useMemo(
    () =>
      categoriesData.map((c) => ({
        id: c.categoryId,
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

  // Determine which channels to display
  const displayChannels = useMemo(() => {
    if (showFavorites) {
      // Return empty if no favorites at all
      if (favorites.length === 0) {
        return [];
      }

      // Return empty if still loading
      if (favoriteChannels === undefined) {
        return [];
      }

      // Filter out nulls first
      let filtered = favoriteChannels.filter(
        (ch): ch is NonNullable<typeof ch> => ch !== null,
      );

      // Apply sort
      if (favoritesSort === "alphabetical") {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else if (favoritesSort === "recent") {
        // Most recently added first (end of favorites array)
        const favoriteOrder = favorites.reduce(
          (acc, id, index) => {
            acc[id] = index;
            return acc;
          },
          {} as Record<string, number>,
        );
        filtered.sort(
          (a, b) =>
            (favoriteOrder[b.channelId] ?? 0) -
            (favoriteOrder[a.channelId] ?? 0),
        );
      } else if (favoritesSort === "most-watched") {
        // Count how many times each channel appears in history
        const watchCounts = history.reduce(
          (acc, entry) => {
            acc[entry.channelId] = (acc[entry.channelId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        filtered.sort(
          (a, b) =>
            (watchCounts[b.channelId] || 0) - (watchCounts[a.channelId] || 0),
        );
      }

      return filtered;
    }

    if (showHistory) {
      // Return empty if no history at all
      if (history.length === 0) {
        return [];
      }

      // Return empty if still loading
      if (historyChannels === undefined) {
        return [];
      }

      // Filter out nulls first
      let filtered = historyChannels.filter(
        (ch): ch is NonNullable<typeof ch> => ch !== null,
      );

      // Apply time filter
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      const filteredHistoryEntries = history.filter((entry) => {
        if (historyTimeFilter === "today") return entry.timestamp >= oneDayAgo;
        if (historyTimeFilter === "week") return entry.timestamp >= oneWeekAgo;
        return true;
      });

      const filteredChannelIds = new Set(
        filteredHistoryEntries.map((e) => e.channelId),
      );
      filtered = filtered.filter((channel) =>
        filteredChannelIds.has(channel.channelId),
      );

      // Sort by most recent first
      const timeOrder = filteredHistoryEntries.reduce(
        (acc, entry, index) => {
          acc[entry.channelId] = index;
          return acc;
        },
        {} as Record<string, number>,
      );
      filtered.sort(
        (a, b) =>
          (timeOrder[a.channelId] ?? Infinity) -
          (timeOrder[b.channelId] ?? Infinity),
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
  ]);

  const totalCount = useMemo(() => {
    return displayChannels.length;
  }, [displayChannels.length]);

  // Build filter chips
  const filterChips = useMemo(() => {
    const chips: Array<{
      type: "category" | "country";
      id: string;
      label: string;
      icon?: string;
    }> = [];

    filters.categories.forEach((id) => {
      const cat = categoriesData.find((c) => c.categoryId === id);
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

  // Handlers
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
    if (status === "CanLoadMore") {
      loadMore(48);
    }
  }, [status, loadMore]);

  // Calculate loading state based on mode
  const isLoading = useMemo(() => {
    if (showFavorites) {
      // Loading if we have favorites but haven't fetched channels yet
      return favorites.length > 0 && favoriteChannels === undefined;
    }
    if (showHistory) {
      // Loading if we have history but haven't fetched channels yet
      return historyChannelIds.length > 0 && historyChannels === undefined;
    }
    // Browse mode loading
    return status === "LoadingFirstPage";
  }, [showFavorites, showHistory, favorites.length, favoriteChannels, historyChannelIds.length, historyChannels, status]);

  const hasMore = status === "CanLoadMore";

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
        {/* Desktop Sidebar */}
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

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          {/* Video Player */}
          {filters.playing && playingChannel && (
            <div className="mb-6">
              <VideoPlayer
                channelName={playingChannel.name}
                stream={playingStream?.[0] ?? null}
                onClose={handleClosePlayer}
              />
            </div>
          )}

          {/* Filter Chips */}
          <div className="mb-4">
            <FilterChips
              chips={filterChips}
              totalCount={totalCount}
              onRemove={handleRemoveChip}
              onClearAll={clearFilters}
            />
          </div>

          {/* Channel Grid */}
          <ChannelGrid
            channels={displayChannels}
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
