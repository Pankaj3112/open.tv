import { useState, useEffect, useMemo } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

export function useChannelsByIds(channelIds: string[]) {
  const [data, setData] = useState<{ channels: Channel[]; isLoading: boolean }>({
    channels: [],
    isLoading: false,
  });

  const idsKey = channelIds.join(',');

  useEffect(() => {
    if (channelIds.length === 0) {
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((prev) => ({ ...prev, isLoading: true }));

    // Fetch each channel individually and combine
    Promise.all(
      channelIds.map((id) =>
        fetch(`/api/channels/${id}`)
          .then((res) => res.json())
          .then((result) => (result.error ? null : result))
          .catch(() => null)
      )
    ).then((results) => {
      if (!cancelled) {
        setData({
          channels: results.filter((ch): ch is Channel => ch !== null),
          isLoading: false,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const channels = useMemo(() => {
    return channelIds.length === 0 ? [] : data.channels;
  }, [channelIds.length, data.channels]);

  return { channels, isLoading: data.isLoading };
}
