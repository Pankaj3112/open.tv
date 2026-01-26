import { useState, useEffect } from 'react';

const STORAGE_KEY = 'opentv-probing-enabled';

export function useProbingEnabled() {
  const [enabled, setEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setEnabled(stored === 'true');
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when changed
  const setEnabledAndPersist = (value: boolean) => {
    setEnabled(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  };

  return {
    enabled: isLoaded ? enabled : true, // Default to true while loading
    setEnabled: setEnabledAndPersist,
    isLoaded
  };
}
