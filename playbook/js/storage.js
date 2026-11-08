// Local library: every play is kept in this browser's localStorage and
// autosaved. Files and share links are how plays leave the device.

import { validatePlay } from './model.js';

const KEY = 'ddg.playbook.v1';

export function loadLibrary() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { current: null, plays: [] };
    const o = JSON.parse(raw);
    const plays = (Array.isArray(o.plays) ? o.plays : [])
      .map((p) => {
        try {
          return validatePlay(p);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return { current: typeof o.current === 'string' ? o.current : null, plays };
  } catch {
    return { current: null, plays: [] };
  }
}

// Returns false when the browser refuses (private mode, quota).
export function saveLibrary(lib) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ current: lib.current, plays: lib.plays }));
    return true;
  } catch {
    return false;
  }
}
