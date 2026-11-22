"use node";

import crypto from "crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function hashPin(pin: string, saltHex: string): string {
  return crypto.scryptSync(pin, saltHex, 32).toString("hex");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const setPin = action({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
    scope: v.union(v.literal("edit"), v.literal("all")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, pin, scope, sessionToken }) => {
    const trimmed = pin.trim();
    if (trimmed.length < 4 || trimmed.length > 32) {
      return { ok: false as const, error: "PIN/passphrase must be 4 to 32 characters." };
    }

    const info = await ctx.runQuery(internal.rooms.getRoomForSecurity, {
      roomId,
      sessionToken,
    });
    if (!info) {
      return { ok: false as const, error: "Note not found." };
    }
    if (info.pinHash && !info.sessionValid) {
      return { ok: false as const, error: "Unlock the current PIN before changing it." };
    }

    const saltHex = crypto.randomBytes(16).toString("hex");
    const derivedHash = hashPin(trimmed, saltHex);
    const newSessionToken = crypto.randomBytes(32).toString("hex");

    await ctx.runMutation(internal.rooms.applyPinUpdate, {
      roomId,
      pinHash: derivedHash,
      pinSalt: saltHex,
      pinScope: scope,
      newSessionToken,
    });

    return { ok: true as const, sessionToken: newSessionToken };
  },
});

export const removePin = action({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, sessionToken }) => {
    const info = await ctx.runQuery(internal.rooms.getRoomForSecurity, {
      roomId,
      sessionToken,
    });
    if (!info) return { ok: false as const, error: "Note not found." };
    if (info.pinHash && !info.sessionValid) {
      return { ok: false as const, error: "Unlock PIN before removing it." };
    }

    await ctx.runMutation(internal.rooms.clearPinUpdate, { roomId });
    return { ok: true as const };
  },
});

export const unlockRoom = action({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, { roomId, pin, clientId }) => {
    const info = await ctx.runQuery(internal.rooms.getRoomForSecurity, {
      roomId,
      clientId,
    });
    if (!info) {
      return { ok: false as const, error: "Note not found." };
    }
    if (!info.pinHash || !info.pinSalt) {
      return { ok: true as const, sessionToken: "" };
    }

    const now = Date.now();
    if (info.attempt?.lockedUntil && info.attempt.lockedUntil > now) {
      const waitMins = Math.max(1, Math.ceil((info.attempt.lockedUntil - now) / 60_000));
      return {
        ok: false as const,
        error: `Too many attempts. Try again in ${waitMins}m.`,
      };
    }

    const candidateHash = hashPin(pin.trim(), info.pinSalt);
    if (!timingSafeHexEqual(candidateHash, info.pinHash)) {
      const fail = await ctx.runMutation(internal.rooms.recordPinFailure, {
        roomId,
        clientId,
      });
      if (fail.lockedUntil) {
        return {
          ok: false as const,
          error: "Too many failed attempts. Locked for 5 minutes.",
        };
      }
      return { ok: false as const, error: "Incorrect PIN. Try again." };
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    await ctx.runMutation(internal.rooms.createSessionAfterUnlock, {
      roomId,
      clientId,
      token: sessionToken,
    });

    return { ok: true as const, sessionToken };
  },
});
