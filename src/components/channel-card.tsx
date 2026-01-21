"use client";

import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Channel {
  _id: string;
  channelId: string;
  name: string;
  logo?: string;
  country: string;
  categories: string[];
}

interface ChannelCardProps {
  channel: Channel;
  countryFlag?: string;
  isPlaying?: boolean;
  isFavorite?: boolean;
  onPlay: (channelId: string) => void;
  onToggleFavorite: (channelId: string) => void;
}

export function ChannelCard({
  channel,
  countryFlag,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: ChannelCardProps) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card p-3 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
        isPlaying && "ring-2 ring-primary"
      )}
      onClick={() => onPlay(channel.channelId)}
    >
      {/* Logo */}
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted mb-2">
        {channel.logo && !logoError ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="h-full w-full object-contain"
            loading="lazy"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {countryFlag || "📺"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-sm">{channel.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            {countryFlag && <span className="text-lg">{countryFlag}</span>}
            {channel.categories[0] && (
              <Badge variant="secondary" className="text-xs capitalize">
                {channel.categories[0]}
              </Badge>
            )}
          </div>
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.channelId);
          }}
          className={cn(
            "p-1 rounded-full transition-colors",
            isFavorite
              ? "text-red-500 hover:text-red-600"
              : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
          )}
        >
          <Heart
            className="h-4 w-4"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      {/* Playing indicator */}
      {isPlaying && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </div>
      )}
    </div>
  );
}
