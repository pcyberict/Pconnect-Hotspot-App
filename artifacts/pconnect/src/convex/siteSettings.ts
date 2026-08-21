import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function requireAdmin(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user || user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admins only" });
  return user;
}

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    return row?.value ?? null;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx): Promise<Record<string, string>> => {
    const rows = await ctx.db.query("siteSettings").collect();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("siteSettings", { key: args.key, value: args.value });
    }
    return null;
  },
});

export const setBulk = mutation({
  args: { settings: v.array(v.object({ key: v.string(), value: v.string() })) },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    for (const { key, value } of args.settings) {
      const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (existing) {
        await ctx.db.patch(existing._id, { value });
      } else {
        await ctx.db.insert("siteSettings", { key, value });
      }
    }
    return null;
  },
});

export const getValueInternal = query({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    return row?.value ?? null;
  },
});

export const getMaskedSecret = query({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<{ masked: string; isSet: boolean } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user || user.role !== "admin") return null;
    const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    if (!row?.value) return { masked: "", isSet: false };
    const val = row.value;
    const visible = val.slice(0, 6);
    const masked = visible + "*".repeat(Math.max(8, val.length - 6));
    return { masked, isSet: true };
  },
});

export const getPublicKey = query({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "flutterwave_public_key")).unique();
    return row?.value ?? null;
  },
});

export const setSecret = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    if (!args.value.trim()) throw new ConvexError({ code: "BAD_REQUEST", message: "Secret value cannot be empty" });
    const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value.trim() });
    } else {
      await ctx.db.insert("siteSettings", { key: args.key, value: args.value.trim() });
    }
    return null;
  },
});
