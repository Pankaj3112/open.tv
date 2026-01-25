"use client";

import { ChannelCard } from "./channel-card";
import { EmptyState } from "./empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";

interface Channel {
  channelId: string;
  name: string;
  logo?: string;
  country: string;
  category: string;
}

interface ChannelGridProps {
  channels: Channel[];
  countryFlags: Record<string, string>;
  playingChannelId?: string;
  favorites: string[];
  onPlay: (channelId: string) => void;
  onToggleFavorite: (channelId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  mode?: "browse" | "favorites" | "history";
}

export function ChannelGrid({
  channels,
  countryFlags,
  playingChannelId,
  favorites,
  onPlay,
  onToggleFavorite,
  onLoadMore,
  hasMore,
  isLoading,
  mode = "browse",
}: ChannelGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  if (isLoading && channels.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-video w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!isLoading && channels.length === 0) {
    return <EmptyState mode={mode} />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.channelId}
            channel={channel}
            countryFlag={countryFlags[channel.country]}
            isPlaying={playingChannelId === channel.channelId}
            isFavorite={favorites.includes(channel.channelId)}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </>
  );
}
