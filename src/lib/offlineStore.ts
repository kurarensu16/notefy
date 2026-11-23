import type { NotefyRoom } from "../types";

const OFFLINE_ROOM_PREFIX = "notefy:offline:room:";
const OFFLINE_DRAFT_PREFIX = "notefy:offline:draft:";
const OFFLINE_PENDING_PREFIX = "notefy:offline:pending:";
const MAX_CACHED_ROOMS = 50;

export interface CachedRoomSnapshot extends NotefyRoom {
  cachedAt: number;
}

export interface OfflineDraft {
  draftId: string; // e.g. "draft-x9k2p4"
  title: string;
  padContent: string;
  createdAt: number;
  updatedAt: number;
}

export interface PendingRoomSync {
  roomId: string;
  code: string;
  displayCode: string;
  title?: string;
  padContent?: string;
  updatedAt: number;
}

export function isOfflineDraftCode(code: string): boolean {
  return code.trim().toLowerCase().startsWith("draft-");
}

function normalizeCodeKey(code: string): string {
  return code.trim().toLowerCase();
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded: evict oldest cached rooms that have no pending sync
    try {
      evictOldestCachedRooms(10);
      localStorage.setItem(key, value);
    } catch {
      // ignore if storage is completely unavailable
    }
  }
}

function evictOldestCachedRooms(count: number): void {
  const pendingCodes = new Set(listPendingRoomSyncs().map((p) => normalizeCodeKey(p.code)));
  const cached: Array<{ key: string; cachedAt: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(OFFLINE_ROOM_PREFIX)) continue;
    const code = key.slice(OFFLINE_ROOM_PREFIX.length);
    if (pendingCodes.has(code)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}") as Partial<CachedRoomSnapshot>;
      cached.push({ key, cachedAt: parsed.cachedAt ?? 0 });
    } catch {
      cached.push({ key, cachedAt: 0 });
    }
  }
  cached.sort((a, b) => a.cachedAt - b.cachedAt);
  for (const item of cached.slice(0, count)) {
    localStorage.removeItem(item.key);
  }
}

/* ---------------- Cached Synced Rooms ---------------- */

export function cacheRoomSnapshot(room: NotefyRoom): void {
  const norm = normalizeCodeKey(room.code);
  if (!norm || isOfflineDraftCode(norm)) return;
  const snapshot: CachedRoomSnapshot = {
    ...room,
    cachedAt: Date.now(),
  };
  safeSetItem(`${OFFLINE_ROOM_PREFIX}${norm}`, JSON.stringify(snapshot));
  trimCachedRooms();
}

function trimCachedRooms(): void {
  try {
    const keys: Array<{ key: string; cachedAt: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(OFFLINE_ROOM_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "{}") as Partial<CachedRoomSnapshot>;
        keys.push({ key, cachedAt: parsed.cachedAt ?? 0 });
      } catch {
        keys.push({ key, cachedAt: 0 });
      }
    }
    if (keys.length <= MAX_CACHED_ROOMS) return;
    const pendingCodes = new Set(listPendingRoomSyncs().map((p) => normalizeCodeKey(p.code)));
    keys.sort((a, b) => a.cachedAt - b.cachedAt);
    let toRemove = keys.length - MAX_CACHED_ROOMS;
    for (const item of keys) {
      if (toRemove <= 0) break;
      const code = item.key.slice(OFFLINE_ROOM_PREFIX.length);
      if (pendingCodes.has(code)) continue;
      localStorage.removeItem(item.key);
      toRemove--;
    }
  } catch {
    // ignore
  }
}

export function getCachedRoomSnapshot(code: string): CachedRoomSnapshot | null {
  const norm = normalizeCodeKey(code);
  if (!norm) return null;
  try {
    const raw = localStorage.getItem(`${OFFLINE_ROOM_PREFIX}${norm}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedRoomSnapshot;
  } catch {
    return null;
  }
}

export function removeCachedRoomSnapshot(code: string): void {
  const norm = normalizeCodeKey(code);
  if (!norm) return;
  try {
    localStorage.removeItem(`${OFFLINE_ROOM_PREFIX}${norm}`);
  } catch {
    // ignore
  }
}

/* ---------------- Offline Drafts (Collision-Free Local Notes) ---------------- */

export function createOfflineDraft(initialTitle = "", initialPadContent = ""): OfflineDraft {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let suffix = "";
  const bytes = new Uint8Array(6);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  const now = Date.now();
  const draft: OfflineDraft = {
    draftId: `draft-${suffix}`,
    title: initialTitle,
    padContent: initialPadContent,
    createdAt: now,
    updatedAt: now,
  };
  safeSetItem(`${OFFLINE_DRAFT_PREFIX}${draft.draftId}`, JSON.stringify(draft));
  return draft;
}

export function getOfflineDraft(draftId: string): OfflineDraft | null {
  const norm = normalizeCodeKey(draftId);
  if (!isOfflineDraftCode(norm)) return null;
  try {
    const raw = localStorage.getItem(`${OFFLINE_DRAFT_PREFIX}${norm}`);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineDraft;
  } catch {
    return null;
  }
}

export function updateOfflineDraft(
  draftId: string,
  patch: Partial<Pick<OfflineDraft, "title" | "padContent">>
): OfflineDraft | null {
  const existing = getOfflineDraft(draftId);
  if (!existing) return null;
  const updated: OfflineDraft = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  safeSetItem(`${OFFLINE_DRAFT_PREFIX}${updated.draftId}`, JSON.stringify(updated));
  return updated;
}

export function deleteOfflineDraft(draftId: string): void {
  const norm = normalizeCodeKey(draftId);
  try {
    localStorage.removeItem(`${OFFLINE_DRAFT_PREFIX}${norm}`);
  } catch {
    // ignore
  }
}

export function listOfflineDrafts(): OfflineDraft[] {
  const drafts: OfflineDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(OFFLINE_DRAFT_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        drafts.push(JSON.parse(raw) as OfflineDraft);
      } catch {
        // ignore corrupted item
      }
    }
  } catch {
    // ignore
  }
  return drafts.sort((a, b) => a.createdAt - b.createdAt);
}

export function draftToRoomView(draft: OfflineDraft): NotefyRoom {
  return {
    id: draft.draftId,
    code: draft.draftId,
    displayCode: draft.draftId,
    title: draft.title,
    padContent: draft.padContent,
    padUpdatedAt: draft.updatedAt,
    readOnlyEnabled: false,
    readOnlyCode: "",
    hasPin: false,
    pinScope: "edit",
    roomExpiryMode: "never",
    expiresAt: null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

/* ---------------- Pending Sync Queue (Existing Synced Notes Edited Offline) ---------------- */

export function queuePendingRoomEdit(
  room: Pick<NotefyRoom, "id" | "code" | "displayCode">,
  patch: { title?: string; padContent?: string }
): void {
  if (isOfflineDraftCode(room.code)) return;
  const key = `${OFFLINE_PENDING_PREFIX}${room.id}`;
  let existing: PendingRoomSync | null = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) existing = JSON.parse(raw) as PendingRoomSync;
  } catch {
    existing = null;
  }

  const next: PendingRoomSync = {
    roomId: room.id,
    code: normalizeCodeKey(room.code),
    displayCode: room.displayCode,
    title: patch.title !== undefined ? patch.title : existing?.title,
    padContent: patch.padContent !== undefined ? patch.padContent : existing?.padContent,
    updatedAt: Date.now(),
  };
  safeSetItem(key, JSON.stringify(next));
}

export function getPendingRoomSync(roomId: string): PendingRoomSync | null {
  try {
    const raw = localStorage.getItem(`${OFFLINE_PENDING_PREFIX}${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PendingRoomSync;
  } catch {
    return null;
  }
}

export function clearPendingRoomSync(roomId: string): void {
  try {
    localStorage.removeItem(`${OFFLINE_PENDING_PREFIX}${roomId}`);
  } catch {
    // ignore
  }
}

export function listPendingRoomSyncs(): PendingRoomSync[] {
  const list: PendingRoomSync[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(OFFLINE_PENDING_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        list.push(JSON.parse(raw) as PendingRoomSync);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return list.sort((a, b) => a.updatedAt - b.updatedAt);
}

export function clearAllOfflineStorage(): void {
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(OFFLINE_ROOM_PREFIX) ||
          key.startsWith(OFFLINE_DRAFT_PREFIX) ||
          key.startsWith(OFFLINE_PENDING_PREFIX))
      ) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
