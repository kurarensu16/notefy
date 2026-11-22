import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";

export const heartbeat = mutation({
  args: {
    roomId: v.id("rooms"),
    clientId: v.string(),
    deviceLabel: v.string(),
    mode: v.union(v.literal("edit"), v.literal("view")),
  },
  handler: async (ctx, { roomId, clientId, deviceLabel, mode }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return;

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_roomId_clientId", (q) =>
        q.eq("roomId", roomId).eq("clientId", clientId)
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        deviceLabel: deviceLabel.slice(0, 32),
        mode,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert("presence", {
        roomId,
        clientId,
        deviceLabel: deviceLabel.slice(0, 32),
        mode,
        lastSeenAt: now,
      });
    }
  },
});

export const leave = mutation({
  args: {
    roomId: v.id("rooms"),
    clientId: v.string(),
  },
  handler: async (ctx, { roomId, clientId }) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_roomId_clientId", (q) =>
        q.eq("roomId", roomId).eq("clientId", clientId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const cleanupStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const presenceCutoff = now - 5 * 60 * 1000;
    const allPresence = await ctx.db.query("presence").collect();
    for (const row of allPresence) {
      if (row.lastSeenAt < presenceCutoff) {
        await ctx.db.delete(row._id);
      }
    }

    const allSessions = await ctx.db.query("roomSessions").collect();
    for (const s of allSessions) {
      if (s.expiresAt <= now) {
        await ctx.db.delete(s._id);
      }
    }

    const attemptCutoff = now - 24 * 60 * 60 * 1000;
    const allAttempts = await ctx.db.query("pinAttempts").collect();
    for (const a of allAttempts) {
      if (a.updatedAt < attemptCutoff) {
        await ctx.db.delete(a._id);
      }
    }

    const allLookups = await ctx.db.query("codeLookups").collect();
    for (const l of allLookups) {
      if (l.windowStart < attemptCutoff) {
        await ctx.db.delete(l._id);
      }
    }
  },
});
