import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    displayCode: v.string(),
    title: v.string(),
    padContent: v.string(),
    padUpdatedAt: v.optional(v.number()),
    readOnlyEnabled: v.boolean(),
    readOnlyCode: v.string(),
    pinHash: v.optional(v.string()),
    pinSalt: v.optional(v.string()),
    pinScope: v.union(v.literal("edit"), v.literal("all")),
    roomExpiryMode: v.union(v.literal("never"), v.literal("24h"), v.literal("7d")),
    expiresAt: v.optional(v.number()),
    expiryJobId: v.optional(v.id("_scheduled_functions")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_readOnlyCode", ["readOnlyCode"]),

  roomSessions: defineTable({
    roomId: v.id("rooms"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_roomId", ["roomId"]),

  presence: defineTable({
    roomId: v.id("rooms"),
    clientId: v.string(),
    deviceLabel: v.string(),
    mode: v.union(v.literal("edit"), v.literal("view")),
    lastSeenAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_clientId", ["roomId", "clientId"]),

  pinAttempts: defineTable({
    roomId: v.id("rooms"),
    clientId: v.string(),
    failedCount: v.number(),
    lockedUntil: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_roomId_clientId", ["roomId", "clientId"]),

  codeLookups: defineTable({
    clientId: v.string(),
    failedCount: v.number(),
    windowStart: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_clientId", ["clientId"]),
});
