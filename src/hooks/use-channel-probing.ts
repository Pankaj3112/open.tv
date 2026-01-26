import { useState, useEffect, useRef, useCallback } from 'react';
import { probeChannelStreams, ProbeStream } from '@/lib/stream-probe';
import { getProbeCache, setProbeCache, clearExpiredCache } from '@/lib/probe-cache';

interface Channel {
  channelId: string;
  name: string;
  logo?: string;
  country: string;
  category: string;
}

type ProbeStatus = 'pending' | 'probing' | 'working' | 'failed';

const MAX_CONCURRENT_PROBES = 3;

export function useChannelProbing(
  channels: Channel[],
  fetchStreamsForChannel: (channelId: string) => Promise<ProbeStream[]>
) {
  const [probingStatus, setProbingStatus] = useState<Map<string, ProbeStatus>>(new Map());
  const [visibleChannelIds, setVisibleChannelIds] = useState<Set<string>>(new Set());
  const probeQueueRef = useRef<string[]>([]);
  const activeProbesRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // Clear expired cache on mount
  useEffect(() => {
    clearExpiredCache();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initialize status from cache
  useEffect(() => {
    const newStatus = new Map<string, ProbeStatus>();

    channels.forEach((channel) => {
      const cached = getProbeCache(channel.channelId);
      if (cached) {
        newStatus.set(channel.channelId, cached.status);
      } else {
        newStatus.set(channel.channelId, 'pending');
      }
    });

    setProbingStatus(newStatus);
  }, [channels]);

  // Process probe queue
  const processQueue = useCallback(async () => {
    if (!mountedRef.current) return;
    if (activeProbesRef.current >= MAX_CONCURRENT_PROBES) return;
    if (probeQueueRef.current.length === 0) return;

    // Prioritize visible channels
    const visibleInQueue = probeQueueRef.current.filter((id) => visibleChannelIds.has(id));
    const nextChannelId = visibleInQueue[0] || probeQueueRef.current[0];

    if (!nextChannelId) return;

    // Remove from queue
    probeQueueRef.current = probeQueueRef.current.filter((id) => id !== nextChannelId);
    activeProbesRef.current++;

    // Update status to probing
    setProbingStatus((prev) => new Map(prev).set(nextChannelId, 'probing'));

    try {
      // Fetch streams for channel
      const streams = await fetchStreamsForChannel(nextChannelId);

      if (!mountedRef.current) return;

      if (streams.length === 0) {
        // No streams available - mark as failed
        setProbingStatus((prev) => new Map(prev).set(nextChannelId, 'failed'));
        setProbeCache(nextChannelId, {
          status: 'failed',
          workingStreamUrls: [],
          timestamp: Date.now(),
        });
      } else {
        // Probe the streams
        const result = await probeChannelStreams(streams);

        if (!mountedRef.current) return;

        const status = result.hasWorking ? 'working' : 'failed';
        setProbingStatus((prev) => new Map(prev).set(nextChannelId, status));
        setProbeCache(nextChannelId, {
          status,
          workingStreamUrls: result.workingStreamUrls,
          timestamp: Date.now(),
        });
      }
    } catch {
      if (mountedRef.current) {
        // On error, mark as failed
        setProbingStatus((prev) => new Map(prev).set(nextChannelId, 'failed'));
      }
    } finally {
      activeProbesRef.current--;
      // Continue processing queue
      processQueue();
    }
  }, [fetchStreamsForChannel, visibleChannelIds]);

  // Queue pending channels for probing
  useEffect(() => {
    const pendingChannels = channels.filter((ch) => {
      const status = probingStatus.get(ch.channelId);
      return status === 'pending';
    });

    pendingChannels.forEach((ch) => {
      if (!probeQueueRef.current.includes(ch.channelId)) {
        probeQueueRef.current.push(ch.channelId);
      }
    });

    // Start processing
    processQueue();
  }, [channels, probingStatus, processQueue]);

  // Register visibility callback for channels
  const registerVisibility = useCallback((channelId: string, isVisible: boolean) => {
    setVisibleChannelIds((prev) => {
      const next = new Set(prev);
      if (isVisible) {
        next.add(channelId);
      } else {
        next.delete(channelId);
      }
      return next;
    });
  }, []);

  // Filter out failed channels
  const filteredChannels = channels.filter((ch) => {
    const status = probingStatus.get(ch.channelId);
    return status !== 'failed';
  });

  const isProbing = Array.from(probingStatus.values()).some(
    (status) => status === 'pending' || status === 'probing'
  );

  return {
    filteredChannels,
    probingStatus,
    isProbing,
    registerVisibility,
  };
}
