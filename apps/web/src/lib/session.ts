export interface StoredSession {
  code: string;
  identity: string;
  name: string;
  sessionKey: string;
}

const KEY = 'telinha.session';

function isStoredSession(v: unknown): v is StoredSession {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return ['code', 'identity', 'name', 'sessionKey'].every((k) => typeof o[k] === 'string');
}

export function loadSession(code: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredSession(parsed) && parsed.code === code ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // sessionStorage indisponível (ex: modo privado restrito): segue sem persistir.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
