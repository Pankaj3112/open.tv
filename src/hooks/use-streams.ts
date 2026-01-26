import { useState, useEffect, useRef, useMemo } from 'react';

interface Stream {
  channel_id: string;
  url: string;
  quality: string | null;
  http_referrer: string | null;
  user_agent: string | null;
}

interface StreamsData {
  channelId: string | null;
  streams: Stream[];
  isLoading: boolean;
}

export function useStreams(channelId: string | null) {
  const [data, setData] = useState<StreamsData>({
    channelId: null,
    streams: [],
    isLoading: false,
  });
  const lastFetchedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    // Skip fetch if channelId hasn't changed
    if (lastFetchedIdRef.current === channelId) {
      return;
    }

    lastFetchedIdRef.current = channelId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, isLoading: true }));

    fetch(`/api/streams/${channelId}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          setData({ channelId, streams: result, isLoading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ channelId, streams: [], isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // Return stable reference - only changes when data.streams changes
  const streams = useMemo(() => {
    return channelId && data.channelId === channelId ? data.streams : [];
  }, [channelId, data.channelId, data.streams]);

  return { streams, isLoading: data.isLoading };
}
