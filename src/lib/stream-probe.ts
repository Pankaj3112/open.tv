export interface ProbeStream {
  url: string;
  quality?: string;
  httpReferrer?: string;
  userAgent?: string;
}

export interface ProbeResult {
  hasWorking: boolean;
  workingStreamUrls: string[];
}

const PROBE_TIMEOUT = 5000; // 5 seconds

export async function probeStream(url: string, timeout = PROBE_TIMEOUT): Promise<boolean> {
  // Must run on client
  if (typeof window === 'undefined') return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      // Don't follow redirects to avoid loading actual video
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Check if response is successful
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

export async function probeChannelStreams(streams: ProbeStream[]): Promise<ProbeResult> {
  const workingStreamUrls: string[] = [];

  // Probe sequentially, stop on first success for efficiency
  for (const stream of streams) {
    const isWorking = await probeStream(stream.url);
    if (isWorking) {
      workingStreamUrls.push(stream.url);
      // Found one working stream - that's enough to show the channel
      return { hasWorking: true, workingStreamUrls };
    }
  }

  return { hasWorking: false, workingStreamUrls: [] };
}
