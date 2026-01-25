import { useState, useEffect } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

export function useChannel(channelId: string | null) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!channelId) {
      setChannel(null);
      return;
    }

    setIsLoading(true);
    fetch(`/api/channels/${channelId}`)
      .then((res) => res.json())
      .then((data) => {
        setChannel(data.error ? null : data);
        setIsLoading(false);
      })
      .catch(() => {
        setChannel(null);
        setIsLoading(false);
      });
  }, [channelId]);

  return { channel, isLoading };
}
