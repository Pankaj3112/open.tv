import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  channels: defineTable({
    channelId: v.string(),
    name: v.string(),
    logo: v.optional(v.string()),
    country: v.string(),
    category: v.string(),
    languages: v.array(v.string()),
    network: v.optional(v.string()),
  })
    .index("by_channelId", ["channelId"])
    .index("by_country", ["country"])
    .index("by_country_name", ["country", "name"])
    .index("by_category", ["category"])
    .index("by_category_country", ["category", "country"])
    .searchIndex("search_name", { searchField: "name" }),

  streams: defineTable({
    channelId: v.string(),
    url: v.string(),
    quality: v.optional(v.string()),
    httpReferrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_channelId", ["channelId"]),

  categories: defineTable({
    categoryId: v.string(),
    name: v.string(),
  }).index("by_categoryId", ["categoryId"]),

  countries: defineTable({
    code: v.string(),
    name: v.string(),
    flag: v.string(),
    languages: v.array(v.string()),
  }).index("by_code", ["code"]),

  languages: defineTable({
    code: v.string(),
    name: v.string(),
  }).index("by_code", ["code"]),

  syncStatus: defineTable({
    lastSyncAt: v.number(),
    status: v.string(),
    channelCount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
});
