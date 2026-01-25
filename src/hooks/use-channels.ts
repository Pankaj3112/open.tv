import { useState, useEffect, useCallback, useRef } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

interface UseChannelsOptions {
  countries?: string[];
  categories?: string[];
  search?: string;
}

type Status = 'loading' | 'idle' | 'hasMore' | 'loadingMore';

export function useChannels(options: UseChannelsOptions) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const cursorRef = useRef<number | null>(null);

  const buildUrl = useCallback((cursor: number) => {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.countries?.length) params.set('countries', options.countries.join(','));
    if (options.categories?.length) params.set('categories', options.categories.join(','));
    params.set('cursor', String(cursor));
    params.set('limit', '20');
    return `/api/channels?${params}`;
  }, [options.search, options.countries, options.categories]);

  // Reset and fetch on filter change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannels([]);
    cursorRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading');

    fetch(buildUrl(0))
      .then((res) => res.json())
      .then((data) => {
        setChannels(data.channels);
        cursorRef.current = data.nextCursor;
        setStatus(data.nextCursor !== null ? 'hasMore' : 'idle');
      })
      .catch(() => {
        setStatus('idle');
      });
  }, [buildUrl]);

  const loadMore = useCallback(() => {
    if (status !== 'hasMore' || cursorRef.current === null) return;

    setStatus('loadingMore');
    fetch(buildUrl(cursorRef.current))
      .then((res) => res.json())
      .then((data) => {
        setChannels((prev) => [...prev, ...data.channels]);
        cursorRef.current = data.nextCursor;
        setStatus(data.nextCursor !== null ? 'hasMore' : 'idle');
      })
      .catch(() => {
        setStatus('hasMore'); // Allow retry
      });
  }, [buildUrl, status]);

  return {
    channels,
    status,
    isLoading: status === 'loading',
    hasMore: status === 'hasMore' || status === 'loadingMore',
    loadMore,
  };
}
