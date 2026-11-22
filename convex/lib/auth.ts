import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const PRESENCE_WINDOW_MS = 65_000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export interface PublicRoom {
  id: Id<"rooms">;
  code: string;
  displayCode: string;
  title: string;
  padContent: string;
  padUpdatedAt: number | null;
  readOnlyEnabled: boolean;
  readOnlyCode: string;
  hasPin: boolean;
  pinScope: "edit" | "all";
  roomExpiryMode: "never" | "24h" | "7d";
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface LockedRoomMeta {
  id: Id<"rooms">;
  code: string;
  displayCode: string;
  readOnlyCode: string;
  hasPin: true;
  pinScope: "edit" | "all";
}

/**
 * Strips all secrets (pinHash, pinSalt) and internal fields (expiryJobId).
 */
export function toPublicRoom(room: Doc<"rooms">): PublicRoom {
  return {
    id: room._id,
    code: room.code,
    displayCode: room.displayCode,
    title: room.title,
    padContent: room.padContent,
    padUpdatedAt: room.padUpdatedAt ?? null,
    readOnlyEnabled: room.readOnlyEnabled,
    readOnlyCode: room.readOnlyCode,
    hasPin: Boolean(room.pinHash),
    pinScope: room.pinScope,
    roomExpiryMode: room.roomExpiryMode,
    expiresAt: room.expiresAt ?? null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

export function toLockedRoomMeta(room: Doc<"rooms">): LockedRoomMeta {
  return {
    id: room._id,
    code: room.code,
    displayCode: room.displayCode,
    readOnlyCode: room.readOnlyCode,
    hasPin: true,
    pinScope: room.pinScope,
  };
}

export function isRoomExpired(room: Doc<"rooms">, now = Date.now()): boolean {
  return Boolean(room.expiresAt && room.expiresAt <= now);
}

export async function isSessionValid(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  sessionToken?: string | null
): Promise<boolean> {
  if (!sessionToken || !sessionToken.trim()) return false;
  const session = await ctx.db
    .query("roomSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken.trim()))
    .unique();
  if (!session) return false;
  if (session.roomId !== roomId) return false;
  if (session.expiresAt <= Date.now()) return false;
  return true;
}

export async function requireEditAccess(
  ctx: QueryCtx | MutationCtx,
  room: Doc<"rooms">,
  sessionToken?: string | null
): Promise<void> {
  if (!room.pinHash) return;
  const ok = await isSessionValid(ctx, room._id, sessionToken);
  if (!ok) {
    throw new Error("PIN_REQUIRED");
  }
}

export async function requireReadAccess(
  ctx: QueryCtx | MutationCtx,
  room: Doc<"rooms">,
  sessionToken?: string | null
): Promise<void> {
  if (!room.pinHash || room.pinScope !== "all") return;
  const ok = await isSessionValid(ctx, room._id, sessionToken);
  if (!ok) {
    throw new Error("PIN_REQUIRED");
  }
}

export async function safeCancelJob(
  ctx: MutationCtx,
  jobId?: Id<"_scheduled_functions">
): Promise<void> {
  if (!jobId) return;
  try {
    await ctx.scheduler.cancel(jobId);
  } catch {
    // Already completed or cancelled
  }
}

export async function getActivePresence(ctx: QueryCtx, roomId: Id<"rooms">) {
  const cutoff = Date.now() - PRESENCE_WINDOW_MS;
  const rows = await ctx.db
    .query("presence")
    .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
    .collect();
  return rows
    .filter((row) => row.lastSeenAt >= cutoff)
    .map((row) => ({
      clientId: row.clientId,
      deviceLabel: row.deviceLabel,
      mode: row.mode,
      lastSeenAt: row.lastSeenAt,
    }));
}

export async function isCodeTaken(
  ctx: QueryCtx | MutationCtx,
  normalizedCode: string,
  excludeRoomId?: Id<"rooms">
): Promise<boolean> {
  const byCode = await ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", normalizedCode))
    .unique();
  if (byCode && byCode._id !== excludeRoomId) return true;

  const byReadOnly = await ctx.db
    .query("rooms")
    .withIndex("by_readOnlyCode", (q) => q.eq("readOnlyCode", normalizedCode))
    .unique();
  if (byReadOnly && byReadOnly._id !== excludeRoomId) return true;

  return false;
}
