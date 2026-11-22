import type { RecentRoom, ThemeMode } from "../types";

const CLIENT_ID_KEY = "notefy:clientId";
const RECENT_ROOMS_KEY = "notefy:recentRooms";
const SESSION_PREFIX = "notefy:session:";
const E2EE_PREFIX = "notefy:e2ee:";
const THEME_KEY = "notefy:theme";

function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = generateClientId();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return generateClientId();
  }
}

export function getRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentRoom(entry: Omit<RecentRoom, "visitedAt">): RecentRoom[] {
  const current = getRecentRooms().filter((r) => r.code !== entry.code);
  const updated: RecentRoom[] = [{ ...entry, visitedAt: Date.now() }, ...current].slice(0, 200);
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota
  }
  return updated;
}

export function removeRecentRoom(code: string): RecentRoom[] {
  const updated = getRecentRooms().filter((r) => r.code !== code);
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function getRoomSessionToken(roomId: string): string | null {
  try {
    return localStorage.getItem(`${SESSION_PREFIX}${roomId}`);
  } catch {
    return null;
  }
}

export function setRoomSessionToken(roomId: string, token: string): void {
  try {
    localStorage.setItem(`${SESSION_PREFIX}${roomId}`, token);
  } catch {
    // ignore
  }
}

export function clearRoomSessionToken(roomId: string): void {
  try {
    localStorage.removeItem(`${SESSION_PREFIX}${roomId}`);
    localStorage.removeItem(`${E2EE_PREFIX}${roomId}`);
  } catch {
    // ignore
  }
}

export function getRoomE2eeKey(roomId: string): string | null {
  try {
    return localStorage.getItem(`${E2EE_PREFIX}${roomId}`);
  } catch {
    return null;
  }
}

export function setRoomE2eeKey(roomId: string, keyB64: string): void {
  try {
    localStorage.setItem(`${E2EE_PREFIX}${roomId}`, keyB64);
  } catch {
    // ignore
  }
}

export function clearRoomE2eeKey(roomId: string): void {
  try {
    localStorage.removeItem(`${E2EE_PREFIX}${roomId}`);
  } catch {
    // ignore
  }
}

export function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function clearBrowserSessionState(): void {
  try {
    localStorage.removeItem(RECENT_ROOMS_KEY);
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(SESSION_PREFIX) || key.startsWith(E2EE_PREFIX))) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
    localStorage.setItem(CLIENT_ID_KEY, generateClientId());
  } catch {
    // ignore
  }
}
