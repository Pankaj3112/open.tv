"use client";

import { useEffect, useRef, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Stream {
  url: string;
  httpReferrer?: string;
  userAgent?: string;
}

interface VideoPlayerProps {
  channelName: string;
  stream: Stream | null;
  onClose: () => void;
}

export function VideoPlayer({ channelName, stream, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initPlayer = async () => {
    if (!stream || !videoRef.current) return;

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

      player.addEventListener("error", (event: any) => {
        console.error("Shaka error:", event.detail);
        setError("Stream unavailable");
        setLoading(false);
      });

      // Configure player
      player.configure({
        streaming: {
          bufferingGoal: 30,
          rebufferingGoal: 2,
          bufferBehind: 30,
        },
      });

      await player.load(stream.url);
      setLoading(false);
      videoRef.current.play();
    } catch (err) {
      console.error("Player error:", err);
      setError("Failed to load stream");
      setLoading(false);
    }
  };

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [stream?.url]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black">
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
            <Button variant="secondary" onClick={initPlayer}>
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
          <span className="font-medium">{channelName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
