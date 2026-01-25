import { useState, useEffect, useMemo } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

export function useChannel(channelId: string | null) {
  const [data, setData] = useState<{ channel: Channel | null; isLoading: boolean }>({
    channel: null,
    isLoading: false,
  });

  useEffect(() => {
    if (!channelId) {
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, isLoading: true }));

    fetch(`/api/channels/${channelId}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          setData({
            channel: result.error ? null : result,
            isLoading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ channel: null, isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const channel = useMemo(() => {
    return channelId ? data.channel : null;
  }, [channelId, data.channel]);

  return { channel, isLoading: data.isLoading };
}
