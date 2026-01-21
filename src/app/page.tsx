"use client";

import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ChannelGrid } from "@/components/channel-grid";
import { VideoPlayer } from "@/components/video-player";
import { FilterChips } from "@/components/filter-chips";
import { Footer } from "@/components/footer";
import { useFilters } from "@/hooks/use-filters";
import { useFavorites } from "@/hooks/use-favorites";
import { useHistory } from "@/hooks/use-history";
import { useMemo, useState, useCallback, Suspense } from "react";

function HomeContent() {
  const { filters, updateFilters, clearFilters } = useFilters();
  const { favorites, toggleFavorite } = useFavorites();
  const { addToHistory, getHistoryChannelIds } = useHistory();

  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch reference data
  const categoriesData = useQuery(api.categories.list) ?? [];
  const countriesData = useQuery(api.countries.list) ?? [];

  // Fetch channels with pagination
  const { results: channels, status, loadMore } = usePaginatedQuery(
    api.channels.list,
    {
      search: filters.search || undefined,
      countries: filters.countries.length ? filters.countries : undefined,
      categories: filters.categories.length ? filters.categories : undefined,
    },
    { initialNumItems: 48 }
  );

  // Fetch favorite channels if showing favorites
  const favoriteChannels = useQuery(
    api.channels.getByIds,
    showFavorites && favorites.length > 0
      ? { channelIds: favorites }
      : "skip"
  );

  // Fetch history channels if showing history
  const historyChannelIds = getHistoryChannelIds();
  const historyChannels = useQuery(
    api.channels.getByIds,
    showHistory && historyChannelIds.length > 0
      ? { channelIds: historyChannelIds }
      : "skip"
  );

  // Fetch current playing channel and stream
  const playingChannel = useQuery(
    api.channels.getById,
    filters.playing ? { channelId: filters.playing } : "skip"
  );
  const playingStream = useQuery(
    api.streams.getByChannelId,
    filters.playing ? { channelId: filters.playing } : "skip"
  );

  // Transform data for components
  const categoryOptions = useMemo(
    () =>
      categoriesData.map((c) => ({
        id: c.categoryId,
        label: c.name,
      })),
    [categoriesData]
  );

  const countryOptions = useMemo(
    () =>
      countriesData.map((c) => ({
        id: c.code,
        label: c.name,
        icon: c.flag,
      })),
    [countriesData]
  );

  const countryFlags = useMemo(
    () =>
      countriesData.reduce(
        (acc, c) => {
          acc[c.code] = c.flag;
          return acc;
        },
        {} as Record<string, string>
      ),
    [countriesData]
  );

  // Determine which channels to display
  const displayChannels = useMemo(() => {
    if (showFavorites && favoriteChannels) {
      return favoriteChannels;
    }
    if (showHistory && historyChannels) {
      return historyChannels;
    }
    return channels;
  }, [showFavorites, favoriteChannels, showHistory, historyChannels, channels]);

  const totalCount = useMemo(() => {
    if (showFavorites) return favorites.length;
    if (showHistory) return historyChannelIds.length;
    return channels.length;
  }, [showFavorites, favorites.length, showHistory, historyChannelIds.length, channels.length]);

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
        chips.push({ type: "country", id, label: country.name, icon: country.flag });
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
    [updateFilters, addToHistory]
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
    [filters, updateFilters]
  );

  const handleShowFavorites = (show: boolean) => {
    setShowFavorites(show);
    if (show) setShowHistory(false);
  };

  const handleShowHistory = (show: boolean) => {
    setShowHistory(show);
    if (show) setShowFavorites(false);
  };

  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      loadMore(48);
    }
  }, [status, loadMore]);

  const isLoading = status === "LoadingFirstPage";
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
          />
        </main>
      </div>

      <Footer />
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
