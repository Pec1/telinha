import { useCallback, useState } from 'react';
import type { ShareMode } from '../lib/media';

const KEY = 'telinha.shareMode';

function readMode(): ShareMode {
  try {
    return localStorage.getItem(KEY) === 'smooth' ? 'smooth' : 'sharp';
  } catch {
    return 'sharp';
  }
}

export function useShareMode(): [ShareMode, (mode: ShareMode) => void] {
  const [mode, setModeState] = useState<ShareMode>(readMode);
  const setMode = useCallback((next: ShareMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignora
    }
  }, []);
  return [mode, setMode];
}
