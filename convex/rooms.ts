import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  getActivePresence,
  isCodeTaken,
  isRoomExpired,
  isSessionValid,
  PIN_COOLDOWN_MS,
  PIN_MAX_ATTEMPTS,
  requireEditAccess,
  requireReadAccess,
  safeCancelJob,
  SESSION_TTL_MS,
  toLockedRoomMeta,
  toPublicRoom,
} from "./lib/auth";
import { decryptAtRest, encryptAtRest } from "./lib/crypto";
import {
  MAX_PAD_LENGTH,
  MAX_TITLE_LENGTH,
  normalizeSlug,
  randomFourCharCode,
  RESERVED_SLUGS,
  validateSlug,
} from "./lib/validation";

const LOOKUP_MAX_FAILURES = 15;
const LOOKUP_WINDOW_MS = 5 * 60 * 1000;
const LOOKUP_COOLDOWN_MS = 5 * 60 * 1000;

async function toDecryptedPublicRoom(room: Doc<"rooms">) {
  const pub = toPublicRoom(room);
  const [title, padContent] = await Promise.all([
    decryptAtRest(pub.title),
    decryptAtRest(pub.padContent),
  ]);
  return { ...pub, title, padContent };
}

async function generateUniqueFourCharCode(
  ctx: MutationCtx,
  extraExcluded?: Set<string>
): Promise<{ code: string; displayCode: string }> {
  for (let i = 0; i < 80; i++) {
    const displayCode = randomFourCharCode();
    const code = displayCode.toLowerCase();
    if (RESERVED_SLUGS.has(code) || extraExcluded?.has(code)) continue;
    const taken = await isCodeTaken(ctx, code);
    if (!taken) {
      return { code, displayCode };
    }
  }
  throw new Error("Could not allocate a unique 4-character access code. Please retry.");
}

async function deleteRoomRecords(ctx: MutationCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  await safeCancelJob(ctx, room.expiryJobId);

  const sessions = await ctx.db
    .query("roomSessions")
    .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
    .collect();
  for (const s of sessions) {
    await ctx.db.delete(s._id);
  }

  const presenceRows = await ctx.db
    .query("presence")
    .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
    .collect();
  for (const p of presenceRows) {
    await ctx.db.delete(p._id);
  }

  const attempts = await ctx.db
    .query("pinAttempts")
    .withIndex("by_roomId_clientId", (q) => q.eq("roomId", roomId))
    .collect();
  for (const a of attempts) {
    await ctx.db.delete(a._id);
  }

  await ctx.db.delete(roomId);
  return room;
}

/**
 * Rate-limited lookup for 4-character codes & custom links (blocks brute-force scanning).
 */
export const resolveCode = mutation({
  args: {
    rawCode: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, { rawCode, clientId }) => {
    const now = Date.now();
    const safeClient = clientId.trim().slice(0, 64) || "anon";

    const tracker = await ctx.db
      .query("codeLookups")
      .withIndex("by_clientId", (q) => q.eq("clientId", safeClient))
      .unique();

    if (tracker?.lockedUntil && tracker.lockedUntil > now) {
      const waitMins = Math.max(1, Math.ceil((tracker.lockedUntil - now) / 60_000));
      return {
        kind: "rate_limited" as const,
        error: `Too many invalid code attempts. Try again in ${waitMins}m.`,
      };
    }

    const cleaned = rawCode.trim().replace(/^\/+/, "");
    if (!cleaned) return { kind: "not_found" as const };

    const norm = normalizeSlug(cleaned);
    const editRoom = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", norm))
      .unique();
    if (editRoom && !isRoomExpired(editRoom)) {
      if (tracker) await ctx.db.delete(tracker._id);
      return { kind: "edit" as const, displayCode: editRoom.displayCode };
    }

    const strippedView = normalizeSlug(cleaned.replace(/^view\//i, ""));
    const viewRoom = await ctx.db
      .query("rooms")
      .withIndex("by_readOnlyCode", (q) => q.eq("readOnlyCode", strippedView))
      .unique();
    if (viewRoom && !isRoomExpired(viewRoom) && viewRoom.readOnlyEnabled) {
      if (tracker) await ctx.db.delete(tracker._id);
      return { kind: "view" as const, readOnlyCode: viewRoom.readOnlyCode };
    }

    // Record failed lookup for rate limiting
    const withinWindow = tracker && now - tracker.windowStart < LOOKUP_WINDOW_MS;
    const nextCount = withinWindow ? tracker.failedCount + 1 : 1;
    const windowStart = withinWindow ? tracker.windowStart : now;
    const lockedUntil = nextCount >= LOOKUP_MAX_FAILURES ? now + LOOKUP_COOLDOWN_MS : undefined;

    if (tracker) {
      await ctx.db.patch(tracker._id, {
        failedCount: nextCount,
        windowStart,
        lockedUntil,
      });
    } else {
      await ctx.db.insert("codeLookups", {
        clientId: safeClient,
        failedCount: nextCount,
        windowStart,
        lockedUntil,
      });
    }

    if (lockedUntil) {
      return {
        kind: "rate_limited" as const,
        error: "Too many invalid code attempts. Try again in 5m.",
      };
    }

    return { kind: "not_found" as const };
  },
});

export const checkCodeAvailability = query({
  args: {
    rawSlug: v.string(),
    excludeRoomId: v.optional(v.id("rooms")),
    mode: v.union(v.literal("edit"), v.literal("readonly")),
  },
  handler: async (ctx, { rawSlug, excludeRoomId, mode }) => {
    const norm = normalizeSlug(rawSlug);
    const status = validateSlug(norm);
    if (status === "empty") return { status: "empty" as const, normalized: "" };
    if (status === "reserved") return { status: "reserved" as const, normalized: norm };
    if (status === "invalid") return { status: "invalid" as const, normalized: norm };

    if (excludeRoomId) {
      const own = await ctx.db.get(excludeRoomId);
      if (own) {
        if (mode === "edit" && norm === own.code) {
          return { status: "same" as const, normalized: norm };
        }
        if (mode === "readonly" && norm === own.readOnlyCode) {
          return { status: "same" as const, normalized: norm };
        }
        if (
          (mode === "edit" && norm === own.readOnlyCode) ||
          (mode === "readonly" && norm === own.code)
        ) {
          return { status: "taken" as const, normalized: norm };
        }
      }
    }

    const taken = await isCodeTaken(ctx, norm, excludeRoomId);
    return {
      status: taken ? ("taken" as const) : ("available" as const),
      normalized: norm,
    };
  },
});

export const getRoomState = query({
  args: {
    code: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, sessionToken }) => {
    const norm = normalizeSlug(code);
    if (!norm) return { status: "not_found" as const };

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", norm))
      .unique();

    if (!room || isRoomExpired(room)) {
      return { status: "not_found" as const };
    }

    const unlocked = room.pinHash ? await isSessionValid(ctx, room._id, sessionToken) : true;

    if (room.pinHash && room.pinScope === "all" && !unlocked) {
      return {
        status: "locked" as const,
        room: toLockedRoomMeta(room),
      };
    }

    const [decryptedRoom, presence] = await Promise.all([
      toDecryptedPublicRoom(room),
      getActivePresence(ctx, room._id),
    ]);

    return {
      status: "ready" as const,
      room: decryptedRoom,
      canEdit: !room.pinHash || unlocked,
      presence,
    };
  },
});

export const getReadOnlyState = query({
  args: {
    shareCode: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { shareCode, sessionToken }) => {
    const norm = normalizeSlug(shareCode);
    if (!norm) return { status: "not_found" as const };

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_readOnlyCode", (q) => q.eq("readOnlyCode", norm))
      .unique();

    if (!room || isRoomExpired(room)) {
      return { status: "not_found" as const };
    }

    if (!room.readOnlyEnabled) {
      return { status: "disabled" as const };
    }

    if (room.pinHash && room.pinScope === "all") {
      const unlocked = await isSessionValid(ctx, room._id, sessionToken);
      if (!unlocked) {
        return {
          status: "locked" as const,
          room: toLockedRoomMeta(room),
        };
      }
    }

    const [decryptedRoom, presence] = await Promise.all([
      toDecryptedPublicRoom(room),
      getActivePresence(ctx, room._id),
    ]);

    return {
      status: "ready" as const,
      room: decryptedRoom,
      presence,
    };
  },
});

export const getRecentMeta = query({
  args: { codes: v.array(v.string()) },
  handler: async (ctx, { codes }) => {
    const uniqueCodes = Array.from(new Set(codes.map(normalizeSlug).filter(Boolean))).slice(0, 200);
    const out: Record<
      string,
      {
        id: Id<"rooms">;
        code: string;
        displayCode: string;
        title: string;
        hasPin: boolean;
        expiresAt: number | null;
        createdAt: number;
        updatedAt: number;
      }
    > = {};

    for (const c of uniqueCodes) {
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", c))
        .unique();
      if (room && !isRoomExpired(room)) {
        const rawTitle = room.pinHash && room.pinScope === "all" ? "" : await decryptAtRest(room.title);
        out[c] = {
          id: room._id,
          code: room.code,
          displayCode: room.displayCode,
          title: rawTitle.startsWith("e2ee:v1:") ? "" : rawTitle,
          hasPin: Boolean(room.pinHash),
          expiresAt: room.expiresAt ?? null,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
        };
      }
    }
    return out;
  },
});

export const createInstant = mutation({
  args: {},
  handler: async (ctx) => {
    const { code, displayCode } = await generateUniqueFourCharCode(ctx);
    const { code: readOnlyCode } = await generateUniqueFourCharCode(ctx, new Set([code]));
    const now = Date.now();

    const id = await ctx.db.insert("rooms", {
      code,
      displayCode,
      title: "",
      padContent: "",
      padUpdatedAt: undefined,
      readOnlyEnabled: true,
      readOnlyCode,
      pinScope: "edit",
      roomExpiryMode: "never",
      createdAt: now,
      updatedAt: now,
    });

    const created = await ctx.db.get(id);
    return toDecryptedPublicRoom(created!);
  },
});

export const createFromDraft = mutation({
  args: {
    title: v.string(),
    padContent: v.string(),
  },
  handler: async (ctx, { title, padContent }) => {
    const { code, displayCode } = await generateUniqueFourCharCode(ctx);
    const { code: readOnlyCode } = await generateUniqueFourCharCode(ctx, new Set([code]));
    const now = Date.now();

    const safeTitle = title.trim().slice(0, MAX_TITLE_LENGTH);
    const safePad = padContent.slice(0, MAX_PAD_LENGTH * 2);
    const [encTitle, encPad] = await Promise.all([
      encryptAtRest(safeTitle),
      encryptAtRest(safePad),
    ]);

    const id = await ctx.db.insert("rooms", {
      code,
      displayCode,
      title: encTitle,
      padContent: encPad,
      padUpdatedAt: safePad ? now : undefined,
      readOnlyEnabled: true,
      readOnlyCode,
      pinScope: "edit",
      roomExpiryMode: "never",
      createdAt: now,
      updatedAt: now,
    });

    const created = await ctx.db.get(id);
    return toDecryptedPublicRoom(created!);
  },
});

export const createOrClaim = mutation({
  args: { rawSlug: v.string() },
  handler: async (ctx, { rawSlug }) => {
    const trimmed = rawSlug.trim();
    const norm = normalizeSlug(trimmed);
    const status = validateSlug(norm);
    if (status === "empty") return { ok: false as const, error: "Enter a valid code or link." };
    if (status === "reserved") {
      return { ok: false as const, error: `"/${norm}" is a reserved route.` };
    }
    if (status === "invalid") {
      return {
        ok: false as const,
        error: "Use 3–40 letters, numbers, or single hyphens (no leading/trailing hyphen).",
      };
    }

    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", norm))
      .unique();
    if (existing && !isRoomExpired(existing)) {
      return { ok: true as const, created: false, room: await toDecryptedPublicRoom(existing) };
    }

    const readOnlyClash = await ctx.db
      .query("rooms")
      .withIndex("by_readOnlyCode", (q) => q.eq("readOnlyCode", norm))
      .unique();
    if (readOnlyClash && !isRoomExpired(readOnlyClash)) {
      return { ok: false as const, error: `"${trimmed}" is already in use.` };
    }

    const { code: readOnlyCode } = await generateUniqueFourCharCode(ctx, new Set([norm]));
    const now = Date.now();
    const id = await ctx.db.insert("rooms", {
      code: norm,
      displayCode: trimmed,
      title: "",
      padContent: "",
      readOnlyEnabled: true,
      readOnlyCode,
      pinScope: "edit",
      roomExpiryMode: "never",
      createdAt: now,
      updatedAt: now,
    });

    const created = await ctx.db.get(id);
    return { ok: true as const, created: true, room: await toDecryptedPublicRoom(created!) };
  },
});

export const duplicate = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.optional(v.string()),
    overrideTitle: v.optional(v.string()),
    overridePadContent: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, sessionToken, overrideTitle, overridePadContent }) => {
    const source = await ctx.db.get(roomId);
    if (!source || isRoomExpired(source)) {
      throw new Error("Note not found.");
    }
    await requireReadAccess(ctx, source, sessionToken);

    const { code, displayCode } = await generateUniqueFourCharCode(ctx);
    const { code: readOnlyCode } = await generateUniqueFourCharCode(ctx, new Set([code]));
    const now = Date.now();

    const plainTitle =
      overrideTitle !== undefined ? overrideTitle : await decryptAtRest(source.title);
    const plainPad =
      overridePadContent !== undefined
        ? overridePadContent
        : await decryptAtRest(source.padContent);

    const baseTitle = plainTitle.trim() || "Untitled Note";
    const copyTitle = `${baseTitle} (Copy)`.slice(0, MAX_TITLE_LENGTH);

    const [encTitle, encPad] = await Promise.all([
      encryptAtRest(copyTitle),
      encryptAtRest(plainPad.slice(0, MAX_PAD_LENGTH)),
    ]);

    const id = await ctx.db.insert("rooms", {
      code,
      displayCode,
      title: encTitle,
      padContent: encPad,
      padUpdatedAt: now,
      readOnlyEnabled: true,
      readOnlyCode,
      pinScope: "edit",
      roomExpiryMode: "never",
      createdAt: now,
      updatedAt: now,
    });

    const created = await ctx.db.get(id);
    return toDecryptedPublicRoom(created!);
  },
});

export const updateTitle = mutation({
  args: {
    roomId: v.id("rooms"),
    title: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, title, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room || isRoomExpired(room)) throw new Error("Note not found.");
    await requireEditAccess(ctx, room, sessionToken);

    const trimmed = title.startsWith("e2ee:v1:")
      ? title.slice(0, 1024)
      : title.trim().slice(0, MAX_TITLE_LENGTH);
    const encTitle = await encryptAtRest(trimmed);

    await ctx.db.patch(roomId, {
      title: encTitle,
      updatedAt: Date.now(),
    });
  },
});

export const updatePad = mutation({
  args: {
    roomId: v.id("rooms"),
    padContent: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, padContent, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room || isRoomExpired(room)) throw new Error("Note not found.");
    await requireEditAccess(ctx, room, sessionToken);

    const now = Date.now();
    // Allow slightly larger envelope when client-side E2EE base64 wraps 200k text
    const clamped = padContent.slice(0, MAX_PAD_LENGTH * 2);
    const encPad = await encryptAtRest(clamped);

    await ctx.db.patch(roomId, {
      padContent: encPad,
      padUpdatedAt: now,
      updatedAt: now,
    });
  },
});

export const updateSlug = mutation({
  args: {
    roomId: v.id("rooms"),
    newSlugRaw: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, newSlugRaw, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room || isRoomExpired(room)) {
      return { ok: false as const, error: "Note not found." };
    }
    try {
      await requireEditAccess(ctx, room, sessionToken);
    } catch {
      return { ok: false as const, error: "Unlock PIN to customize link." };
    }

    const trimmed = newSlugRaw.trim();
    const norm = normalizeSlug(trimmed);
    const status = validateSlug(norm);
    if (status === "reserved") return { ok: false as const, error: `"/${norm}" is reserved.` };
    if (status !== "valid") {
      return { ok: false as const, error: "Use 3–40 letters, numbers, or single hyphens." };
    }

    const taken = await isCodeTaken(ctx, norm, roomId);
    if (taken || norm === room.readOnlyCode) {
      return { ok: false as const, error: `"${trimmed}" is already in use.` };
    }

    await ctx.db.patch(roomId, {
      code: norm,
      displayCode: trimmed,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(roomId);
    return { ok: true as const, room: await toDecryptedPublicRoom(updated!) };
  },
});

export const regenerateEditCode = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room || isRoomExpired(room)) {
      return { ok: false as const, error: "Note not found." };
    }
    try {
      await requireEditAccess(ctx, room, sessionToken);
    } catch {
      return { ok: false as const, error: "Unlock PIN to regenerate code." };
    }

    const { code, displayCode } = await generateUniqueFourCharCode(
      ctx,
      new Set([room.code, room.readOnlyCode])
    );

    await ctx.db.patch(roomId, {
      code,
      displayCode,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(roomId);
    return { ok: true as const, room: await toDecryptedPublicRoom(updated!) };
  },
});

export const updateReadOnly = mutation({
  args: {
    roomId: v.id("rooms"),
    enabled: v.optional(v.boolean()),
    customCode: v.optional(v.string()),
    regenerate: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, enabled, customCode, regenerate, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room || isRoomExpired(room)) {
      return { ok: false as const, error: "Note not found." };
    }
    try {
      await requireEditAccess(ctx, room, sessionToken);
    } catch {
      return { ok: false as const, error: "Unlock PIN to update read-only settings." };
    }

    let nextReadOnlyCode = room.readOnlyCode;
    if (regenerate) {
      const { code } = await generateUniqueFourCharCode(ctx, new Set([room.code, room.readOnlyCode]));
      nextReadOnlyCode = code;
    } else if (customCode !== undefined) {
      const norm = normalizeSlug(customCode);
      const status = validateSlug(norm);
      if (status === "reserved") return { ok: false as const, error: `"/view/${norm}" is reserved.` };
      if (status !== "valid") {
        return { ok: false as const, error: "Use 3–40 letters, numbers, or single hyphens." };
      }
      const taken = await isCodeTaken(ctx, norm, roomId);
      if (taken || norm === room.code) {
        return { ok: false as const, error: `"${customCode.trim()}" is already in use.` };
      }
      nextReadOnlyCode = norm;
    }

    await ctx.db.patch(roomId, {
      readOnlyEnabled: enabled ?? room.readOnlyEnabled,
      readOnlyCode: nextReadOnlyCode,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(roomId);
    return { ok: true as const, room: await toDecryptedPublicRoom(updated!) };
  },
});

export const setRoomExpiry = mutation({
  args: {
    roomId: v.id("rooms"),
    mode: v.union(v.literal("never"), v.literal("24h"), v.literal("7d")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, mode, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room || isRoomExpired(room)) throw new Error("Note not found.");
    await requireEditAccess(ctx, room, sessionToken);

    await safeCancelJob(ctx, room.expiryJobId);

    const now = Date.now();
    if (mode === "never") {
      await ctx.db.patch(roomId, {
        roomExpiryMode: "never",
        expiresAt: undefined,
        expiryJobId: undefined,
        updatedAt: now,
      });
      return;
    }

    const delayMs = mode === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const expiresAt = now + delayMs;
    const jobId = await ctx.scheduler.runAfter(delayMs, internal.rooms.expireRoom, {
      roomId,
      expectedExpiresAt: expiresAt,
    });

    await ctx.db.patch(roomId, {
      roomExpiryMode: mode,
      expiresAt,
      expiryJobId: jobId,
      updatedAt: now,
    });
  },
});

export const deleteRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    await requireEditAccess(ctx, room, sessionToken);

    const removed = await deleteRoomRecords(ctx, roomId);
    if (!removed) return null;
    const [title, padContent] = await Promise.all([
      decryptAtRest(removed.title),
      decryptAtRest(removed.padContent),
    ]);
    return {
      code: removed.code,
      displayCode: removed.displayCode,
      title,
      padContent,
      readOnlyEnabled: removed.readOnlyEnabled,
      readOnlyCode: removed.readOnlyCode,
    };
  },
});

export const restoreRoom = mutation({
  args: {
    code: v.string(),
    displayCode: v.string(),
    title: v.string(),
    padContent: v.string(),
    readOnlyEnabled: v.boolean(),
    readOnlyCode: v.string(),
  },
  handler: async (ctx, args) => {
    const normCode = normalizeSlug(args.code);
    const codeTaken = await isCodeTaken(ctx, normCode);
    const finalMain = codeTaken
      ? await generateUniqueFourCharCode(ctx)
      : { code: normCode, displayCode: args.displayCode };

    const normView = normalizeSlug(args.readOnlyCode);
    const viewTaken = normView === finalMain.code || (await isCodeTaken(ctx, normView));
    const finalViewCode = viewTaken
      ? (await generateUniqueFourCharCode(ctx, new Set([finalMain.code]))).code
      : normView;

    const now = Date.now();
    const [encTitle, encPad] = await Promise.all([
      encryptAtRest(args.title.slice(0, MAX_TITLE_LENGTH)),
      encryptAtRest(args.padContent.slice(0, MAX_PAD_LENGTH * 2)),
    ]);

    const id = await ctx.db.insert("rooms", {
      code: finalMain.code,
      displayCode: finalMain.displayCode,
      title: encTitle,
      padContent: encPad,
      padUpdatedAt: now,
      readOnlyEnabled: args.readOnlyEnabled,
      readOnlyCode: finalViewCode,
      pinScope: "edit",
      roomExpiryMode: "never",
      createdAt: now,
      updatedAt: now,
    });

    const restored = await ctx.db.get(id);
    return toDecryptedPublicRoom(restored!);
  },
});

export const expireRoom = internalMutation({
  args: {
    roomId: v.id("rooms"),
    expectedExpiresAt: v.number(),
  },
  handler: async (ctx, { roomId, expectedExpiresAt }) => {
    const room = await ctx.db.get(roomId);
    if (!room || !room.expiresAt) return;
    if (room.expiresAt !== expectedExpiresAt) return;
    if (room.expiresAt > Date.now() + 1_000) return;
    await deleteRoomRecords(ctx, roomId);
  },
});

/* -------- Internal helpers used exclusively by convex/security.ts ("use node") -------- */

export const getRoomForSecurity = internalQuery({
  args: {
    roomId: v.id("rooms"),
    clientId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, clientId, sessionToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room || isRoomExpired(room)) return null;

    const sessionValid = room.pinHash
      ? await isSessionValid(ctx, roomId, sessionToken)
      : true;

    let attempt = null;
    if (clientId) {
      attempt = await ctx.db
        .query("pinAttempts")
        .withIndex("by_roomId_clientId", (q) =>
          q.eq("roomId", roomId).eq("clientId", clientId)
        )
        .unique();
    }

    return {
      roomId: room._id,
      pinHash: room.pinHash ?? null,
      pinSalt: room.pinSalt ?? null,
      pinScope: room.pinScope,
      sessionValid,
      attempt: attempt
        ? {
            failedCount: attempt.failedCount,
            lockedUntil: attempt.lockedUntil ?? null,
          }
        : null,
    };
  },
});

export const applyPinUpdate = internalMutation({
  args: {
    roomId: v.id("rooms"),
    pinHash: v.string(),
    pinSalt: v.string(),
    pinScope: v.union(v.literal("edit"), v.literal("all")),
    newSessionToken: v.string(),
  },
  handler: async (ctx, { roomId, pinHash, pinSalt, pinScope, newSessionToken }) => {
    const now = Date.now();
    await ctx.db.patch(roomId, {
      pinHash,
      pinSalt,
      pinScope,
      updatedAt: now,
    });

    const oldSessions = await ctx.db
      .query("roomSessions")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect();
    for (const s of oldSessions) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.insert("roomSessions", {
      roomId,
      token: newSessionToken,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
  },
});

export const clearPinUpdate = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await ctx.db.patch(roomId, {
      pinHash: undefined,
      pinSalt: undefined,
      updatedAt: Date.now(),
    });
    const oldSessions = await ctx.db
      .query("roomSessions")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect();
    for (const s of oldSessions) {
      await ctx.db.delete(s._id);
    }
  },
});

export const recordPinFailure = internalMutation({
  args: {
    roomId: v.id("rooms"),
    clientId: v.string(),
  },
  handler: async (ctx, { roomId, clientId }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("pinAttempts")
      .withIndex("by_roomId_clientId", (q) =>
        q.eq("roomId", roomId).eq("clientId", clientId)
      )
      .unique();

    const nextCount = (existing?.failedCount ?? 0) + 1;
    const lockedUntil = nextCount >= PIN_MAX_ATTEMPTS ? now + PIN_COOLDOWN_MS : undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        failedCount: nextCount,
        lockedUntil,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("pinAttempts", {
        roomId,
        clientId,
        failedCount: nextCount,
        lockedUntil,
        updatedAt: now,
      });
    }
    return { failedCount: nextCount, lockedUntil: lockedUntil ?? null };
  },
});

export const createSessionAfterUnlock = internalMutation({
  args: {
    roomId: v.id("rooms"),
    clientId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { roomId, clientId, token }) => {
    const now = Date.now();
    const attempt = await ctx.db
      .query("pinAttempts")
      .withIndex("by_roomId_clientId", (q) =>
        q.eq("roomId", roomId).eq("clientId", clientId)
      )
      .unique();
    if (attempt) {
      await ctx.db.delete(attempt._id);
    }

    await ctx.db.insert("roomSessions", {
      roomId,
      token,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
  },
});
