import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

async function requireAdminMutation(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user || user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admins only" });
  return user;
}

async function requireAdminQuery(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user || user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admins only" });
  return user;
}

export const listActivePlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("voucherPlans").withIndex("by_active", (q) => q.eq("active", true)).collect();
    plans.sort((a, b) => a.sortOrder - b.sortOrder);
    return await Promise.all(plans.map(async (plan) => {
      const available = await ctx.db.query("vouchers").withIndex("by_plan_and_status", (q) => q.eq("planId", plan._id).eq("status", "available")).collect();
      return { ...plan, availableCount: available.length };
    }));
  },
});

export const listAllPlans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);
    const plans = await ctx.db.query("voucherPlans").collect();
    plans.sort((a, b) => a.sortOrder - b.sortOrder);
    return await Promise.all(plans.map(async (plan) => {
      const [available, sold, disabled] = await Promise.all([
        ctx.db.query("vouchers").withIndex("by_plan_and_status", (q) => q.eq("planId", plan._id).eq("status", "available")).collect(),
        ctx.db.query("vouchers").withIndex("by_plan_and_status", (q) => q.eq("planId", plan._id).eq("status", "sold")).collect(),
        ctx.db.query("vouchers").withIndex("by_plan_and_status", (q) => q.eq("planId", plan._id).eq("status", "disabled")).collect(),
      ]);
      return { ...plan, availableCount: available.length, soldCount: sold.length, disabledCount: disabled.length };
    }));
  },
});

const featureValidator = v.optional(v.array(v.object({ icon: v.string(), text: v.string() })));

export const createPlan = mutation({
  args: { name: v.string(), durationLabel: v.string(), durationHours: v.number(), price: v.number(), dataLimit: v.optional(v.string()), description: v.optional(v.string()), features: featureValidator, popular: v.boolean(), active: v.boolean(), sortOrder: v.number() },
  handler: async (ctx, args): Promise<Id<"voucherPlans">> => {
    await requireAdminMutation(ctx);
    return await ctx.db.insert("voucherPlans", args);
  },
});

// Seeds 4 default plans when the table is empty — safe to call on every app load
export const seedDefaultPlans = mutation({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const existing = await ctx.db.query("voucherPlans").first();
    if (existing) return false; // already seeded
    const defaults = [
      {
        name: "1 Day Pass",
        durationLabel: "24 Hours Access",
        durationHours: 24,
        price: 200,
        popular: false,
        active: true,
        sortOrder: 1,
        description: "Perfect for short-term browsing needs.",
        features: [
          { icon: "zap", text: "High Speed Internet" },
          { icon: "wifi", text: "Full Hotspot Access" },
          { icon: "headphones", text: "24/7 Support" },
        ],
      },
      {
        name: "3 Days Pass",
        durationLabel: "72 Hours Access",
        durationHours: 72,
        price: 500,
        popular: false,
        active: true,
        sortOrder: 2,
        description: "Great for a weekend of seamless browsing.",
        features: [
          { icon: "zap", text: "High Speed Internet" },
          { icon: "wifi", text: "Full Hotspot Access" },
          { icon: "shield", text: "Secure Connection" },
          { icon: "headphones", text: "24/7 Support" },
        ],
      },
      {
        name: "7 Days Pass",
        durationLabel: "168 Hours Access",
        durationHours: 168,
        price: 1000,
        popular: true,
        active: true,
        sortOrder: 3,
        description: "Our most popular weekly plan. Best value!",
        features: [
          { icon: "zap", text: "High Speed Internet" },
          { icon: "wifi", text: "Full Hotspot Access" },
          { icon: "shield", text: "Secure Connection" },
          { icon: "globe", text: "Unlimited Browsing" },
          { icon: "headphones", text: "24/7 Priority Support" },
        ],
      },
      {
        name: "30 Days Pass",
        durationLabel: "720 Hours Access",
        durationHours: 720,
        price: 3000,
        popular: false,
        active: true,
        sortOrder: 4,
        description: "Best for power users and heavy usage.",
        features: [
          { icon: "zap", text: "High Speed Internet" },
          { icon: "wifi", text: "Full Hotspot Access" },
          { icon: "shield", text: "Secure Connection" },
          { icon: "globe", text: "Unlimited Browsing" },
          { icon: "crown", text: "Premium Access" },
          { icon: "headphones", text: "24/7 Priority Support" },
        ],
      },
    ];
    for (const plan of defaults) {
      await ctx.db.insert("voucherPlans", plan);
    }
    return true;
  },
});

export const updatePlan = mutation({
  args: { id: v.id("voucherPlans"), name: v.optional(v.string()), durationLabel: v.optional(v.string()), durationHours: v.optional(v.number()), price: v.optional(v.number()), dataLimit: v.optional(v.string()), description: v.optional(v.string()), features: featureValidator, popular: v.optional(v.boolean()), active: v.optional(v.boolean()), sortOrder: v.optional(v.number()) },
  handler: async (ctx, args): Promise<null> => {
    await requireAdminMutation(ctx);
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
    return null;
  },
});
