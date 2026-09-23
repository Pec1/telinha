import { useCallback, useState } from 'react';
import { SHARE_MODES, type ShareMode } from '../lib/media';

const KEY = 'telinha.shareMode';

function readMode(): ShareMode {
  try {
    const stored = localStorage.getItem(KEY);
    return SHARE_MODES.includes(stored as ShareMode) ? (stored as ShareMode) : 'sharp';
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
