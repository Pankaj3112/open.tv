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

  // Create stable string keys
  const searchKey = options.search ?? '';
  const countriesKey = options.countries?.join(',') ?? '';
  const categoriesKey = options.categories?.join(',') ?? '';

  // Reset and fetch when filters change
  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      setChannels([]);
      cursorRef.current = null;
      setStatus('loading');

      const params = new URLSearchParams();
      if (searchKey) params.set('search', searchKey);
      if (countriesKey) params.set('countries', countriesKey);
      if (categoriesKey) params.set('categories', categoriesKey);
      params.set('cursor', '0');
      params.set('limit', '20');

      try {
        const res = await fetch(`/api/channels?${params}`);
        const data = await res.json();

        if (!cancelled) {
          setChannels(data.channels || []);
          cursorRef.current = data.nextCursor;
          setStatus(data.nextCursor !== null ? 'hasMore' : 'idle');
        }
      } catch {
        if (!cancelled) {
          setStatus('idle');
        }
      }
    };

    doFetch();

    return () => {
      cancelled = true;
    };
  }, [searchKey, countriesKey, categoriesKey]);

  const loadMore = useCallback(() => {
    if (status !== 'hasMore' || cursorRef.current === null) return;

    setStatus('loadingMore');

    const params = new URLSearchParams();
    if (searchKey) params.set('search', searchKey);
    if (countriesKey) params.set('countries', countriesKey);
    if (categoriesKey) params.set('categories', categoriesKey);
    params.set('cursor', String(cursorRef.current));
    params.set('limit', '20');

    fetch(`/api/channels?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setChannels((prev) => [...prev, ...(data.channels || [])]);
        cursorRef.current = data.nextCursor;
        setStatus(data.nextCursor !== null ? 'hasMore' : 'idle');
      })
      .catch(() => {
        setStatus('hasMore');
      });
  }, [status, searchKey, countriesKey, categoriesKey]);

  return {
    channels,
    status,
    isLoading: status === 'loading',
    hasMore: status === 'hasMore' || status === 'loadingMore',
    loadMore,
  };
}
