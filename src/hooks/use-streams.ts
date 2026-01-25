import { useState, useEffect } from 'react';

interface Stream {
  channel_id: string;
  url: string;
  quality: string | null;
  http_referrer: string | null;
  user_agent: string | null;
}

export function useStreams(channelId: string | null) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!channelId) {
      setStreams([]);
      return;
    }

    setIsLoading(true);
    fetch(`/api/streams/${channelId}`)
      .then((res) => res.json())
      .then((data) => {
        setStreams(data);
        setIsLoading(false);
      })
      .catch(() => {
        setStreams([]);
        setIsLoading(false);
      });
  }, [channelId]);

  return { streams, isLoading };
}
