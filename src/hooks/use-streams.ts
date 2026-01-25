import { useState, useEffect, useMemo } from 'react';

interface Stream {
  channel_id: string;
  url: string;
  quality: string | null;
  http_referrer: string | null;
  user_agent: string | null;
}

export function useStreams(channelId: string | null) {
  const [data, setData] = useState<{ streams: Stream[]; isLoading: boolean }>({
    streams: [],
    isLoading: false,
  });

  useEffect(() => {
    if (!channelId) {
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, isLoading: true }));

    fetch(`/api/streams/${channelId}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          setData({ streams: result, isLoading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ streams: [], isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const streams = useMemo(() => {
    return channelId ? data.streams : [];
  }, [channelId, data.streams]);

  return { streams, isLoading: data.isLoading };
}
