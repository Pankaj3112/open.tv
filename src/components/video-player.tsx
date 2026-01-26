"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Stream {
  url: string;
  httpReferrer?: string;
  userAgent?: string;
}

interface VideoPlayerProps {
  channelName: string;
  streams: Stream[];
  onClose: () => void;
}

export function VideoPlayer({ channelName, streams, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const playerRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const [isFloating, setIsFloating] = useState(false);

  const currentStream = streams[currentStreamIndex];

  const tryNextStream = useCallback(() => {
    if (currentStreamIndex < streams.length - 1) {
      setCurrentStreamIndex((prev) => prev + 1);
    } else {
      setError("No working streams available. Try again later.");
      setLoading(false);
    }
  }, [currentStreamIndex, streams.length]);

  const handleRetry = useCallback(() => {
    setCurrentStreamIndex(0);
    setError(null);
  }, []);

  // Reset stream index when streams change (new channel selected)
  useEffect(() => {
    setCurrentStreamIndex(0);
    setError(null);
  }, [streams]);

  const initPlayer = useCallback(async () => {
    if (!currentStream || !videoRef.current) {
      if (streams.length === 0) {
        setError("No streams available for this channel.");
        setLoading(false);
      }
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const shakaModule = await import("shaka-player");
      const shaka = shakaModule.default;

      // Install polyfills
      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        setError("Browser not supported for video playback");
        setLoading(false);
        return;
      }

      // Destroy existing player
      if (playerRef.current) {
        await playerRef.current.destroy();
      }

      const player = new shaka.Player();
      await player.attach(videoRef.current);
      playerRef.current = player;

      player.addEventListener("error", (event) => {
        console.error("Shaka error:", event);
        tryNextStream();
      });

      // Configure player
      player.configure({
        streaming: {
          bufferingGoal: 30,
          rebufferingGoal: 2,
          bufferBehind: 30,
        },
      });

      await player.load(currentStream.url);
      setLoading(false);
      videoRef.current.play();
    } catch (err) {
      console.error("Player error:", err);
      tryNextStream();
    }
  }, [currentStream, streams.length, tryNextStream]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [initPlayer]);

  // Intersection Observer for smart floating
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Float when less than 50% of the player is visible
        setIsFloating(!entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleExpand = useCallback(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      {/* Placeholder to maintain layout space */}
      <div ref={containerRef} className="w-full aspect-video" />

      {/* Floating player */}
      <div
        className={`
          overflow-hidden rounded-lg bg-black shadow-2xl
          transition-all duration-300 ease-in-out
          ${isFloating
            ? "fixed bottom-4 right-4 z-50 w-80 md:w-96"
            : "absolute inset-0"
          }
        `}
        style={!isFloating ? { position: "absolute", top: 0, left: 0, right: 0 } : undefined}
      >
        {/* Video container with 16:9 aspect ratio */}
        <div className="relative aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full"
            controls
            autoPlay
            playsInline
          />

          {/* Loading overlay */}
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
              <p className="mb-4 text-lg">{error}</p>
              <Button variant="secondary" onClick={handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* Player bar */}
        <div className="flex items-center justify-between bg-card px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
            <span className={`font-medium ${isFloating ? "text-sm truncate max-w-32" : ""}`}>
              {channelName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isFloating && (
              <Button variant="ghost" size="sm" onClick={handleExpand}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
