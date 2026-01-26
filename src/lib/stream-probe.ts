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

  return new Promise(async (resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);

    let player: { destroy: () => Promise<void> } | null = null;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';

    const cleanup = async () => {
      clearTimeout(timeoutId);
      if (player) {
        try {
          await player.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
      video.src = '';
      video.load();
    };

    try {
      const shakaModule = await import('shaka-player');
      const shaka = shakaModule.default;

      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        cleanup();
        resolve(false);
        return;
      }

      player = new shaka.Player();
      await (player as unknown as { attach: (el: HTMLVideoElement) => Promise<void> }).attach(video);

      // Listen for errors
      (player as unknown as { addEventListener: (event: string, cb: () => void) => void }).addEventListener('error', () => {
        cleanup();
        resolve(false);
      });

      // Try to load - success means stream is working
      await (player as unknown as { load: (url: string) => Promise<void> }).load(url);
      cleanup();
      resolve(true);
    } catch {
      cleanup();
      resolve(false);
    }
  });
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
