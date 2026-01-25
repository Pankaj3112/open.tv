import { useState, useEffect } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

export function useChannelsByIds(channelIds: string[]) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (channelIds.length === 0) {
      setChannels([]);
      return;
    }

    setIsLoading(true);

    // Fetch each channel individually and combine
    Promise.all(
      channelIds.map((id) =>
        fetch(`/api/channels/${id}`)
          .then((res) => res.json())
          .then((data) => (data.error ? null : data))
          .catch(() => null)
      )
    ).then((results) => {
      setChannels(results.filter((ch): ch is Channel => ch !== null));
      setIsLoading(false);
    });
  }, [channelIds.join(',')]); // Join to create stable dependency

  return { channels, isLoading };
}
