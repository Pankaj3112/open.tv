import { useState, useEffect, useRef, useMemo } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

interface ChannelData {
  channelId: string | null;
  channel: Channel | null;
  isLoading: boolean;
}

export function useChannel(channelId: string | null) {
  const [data, setData] = useState<ChannelData>({
    channelId: null,
    channel: null,
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

    fetch(`/api/channels/${channelId}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          setData({
            channelId,
            channel: result.error ? null : result,
            isLoading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ channelId, channel: null, isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // Return stable reference - only changes when data.channel changes
  const channel = useMemo(() => {
    return channelId && data.channelId === channelId ? data.channel : null;
  }, [channelId, data.channelId, data.channel]);

  return { channel, isLoading: data.isLoading };
}
