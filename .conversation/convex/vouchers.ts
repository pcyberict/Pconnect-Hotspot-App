import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

async function requireUserMutation(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  return user;
}

async function requireAdminMutation(ctx: MutationCtx) {
  const user = await requireUserMutation(ctx);
  if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admins only" });
  return user;
}

async function requireAdminQuery(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user || user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admins only" });
  return user;
}

export const bulkImportVouchers = mutation({
  args: {
    planId: v.id("voucherPlans"),
    vouchers: v.array(v.object({ username: v.string(), password: v.string() })),
    importBatchId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ inserted: number; skipped: number }> => {
    await requireAdminMutation(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new ConvexError({ code: "NOT_FOUND", message: "Plan not found" });
    let inserted = 0;
    let skipped = 0;
    const batchId = args.importBatchId ?? `batch-${Date.now()}`;
    for (const voucher of args.vouchers) {
      const username = voucher.username.trim();
      const password = voucher.password.trim();
      if (!username || !password) { skipped++; continue; }
      const existing = await ctx.db.query("vouchers").withIndex("by_username", (q) => q.eq("username", username)).unique();
      if (existing) { skipped++; continue; }
      await ctx.db.insert("vouchers", { planId: args.planId, username, password, status: "available", importBatchId: batchId });
      inserted++;
    }
    return { inserted, skipped };
  },
});

export const createSingleVoucher = mutation({
  args: { planId: v.id("voucherPlans"), username: v.string(), password: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"vouchers">> => {
    await requireAdminMutation(ctx);
    const existing = await ctx.db.query("vouchers").withIndex("by_username", (q) => q.eq("username", args.username.trim())).unique();
    if (existing) throw new ConvexError({ code: "CONFLICT", message: "Username already exists" });
    return await ctx.db.insert("vouchers", { planId: args.planId, username: args.username.trim(), password: args.password.trim(), status: "available", notes: args.notes });
  },
});

export const setVoucherStatus = mutation({
  args: { voucherId: v.id("vouchers"), status: v.union(v.literal("available"), v.literal("disabled")) },
  handler: async (ctx, args): Promise<null> => {
    await requireAdminMutation(ctx);
    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new ConvexError({ code: "NOT_FOUND", message: "Voucher not found" });
    if (voucher.status === "sold") throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot change status of a sold voucher" });
    await ctx.db.patch(args.voucherId, { status: args.status });
    return null;
  },
});

export const listVouchersAdmin = query({
  args: { planId: v.optional(v.id("voucherPlans")), status: v.optional(v.union(v.literal("available"), v.literal("reserved"), v.literal("sold"), v.literal("disabled"))) },
  handler: async (ctx, args) => {
    await requireAdminQuery(ctx);
    if (args.planId && args.status) {
      return await ctx.db.query("vouchers").withIndex("by_plan_and_status", (q) => q.eq("planId", args.planId!).eq("status", args.status!)).take(200);
    } else if (args.planId) {
      return await ctx.db.query("vouchers").withIndex("by_plan", (q) => q.eq("planId", args.planId!)).take(200);
    } else if (args.status) {
      return await ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", args.status!)).take(200);
    }
    return await ctx.db.query("vouchers").take(200);
  },
});

export const getInventoryCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);
    const [available, reserved, sold, disabled] = await Promise.all([
      ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", "available")).collect(),
      ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", "reserved")).collect(),
      ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", "sold")).collect(),
      ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", "disabled")).collect(),
    ]);
    return { available: available.length, reserved: reserved.length, sold: sold.length, disabled: disabled.length };
  },
});

export const purchaseVoucher = mutation({
  args: { planId: v.id("voucherPlans") },
  handler: async (ctx, args): Promise<{ purchaseId: Id<"purchases">; username: string; password: string; planName: string; amount: number }> => {
    const user = await requireUserMutation(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan || !plan.active) throw new ConvexError({ code: "NOT_FOUND", message: "Plan not available" });
    const voucher = await ctx.db.query("vouchers").withIndex("by_plan_and_status", (q) => q.eq("planId", args.planId).eq("status", "available")).first();
    if (!voucher) throw new ConvexError({ code: "BAD_REQUEST", message: "No vouchers available for this plan right now. Please try again later." });
    const wallet = await ctx.db.query("wallets").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (!wallet) throw new ConvexError({ code: "NOT_FOUND", message: "Wallet not found" });
    if (wallet.balance < plan.price) throw new ConvexError({ code: "BAD_REQUEST", message: `Insufficient wallet balance. You need ${plan.price} but have ${wallet.balance}.` });
    await ctx.db.patch(voucher._id, { status: "reserved" });
    const newBalance = wallet.balance - plan.price;
    const reference = `pcc-buy-${user._id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const walletTxId = await ctx.db.insert("walletTransactions", {
      userId: user._id, walletId: wallet._id, type: "purchase", amount: plan.price,
      previousBalance: wallet.balance, newBalance, status: "successful", reference,
      description: `Voucher purchase: ${plan.name}`, createdAt: new Date().toISOString(),
    });
    await ctx.db.patch(wallet._id, { balance: newBalance });
    const purchaseId = await ctx.db.insert("purchases", {
      userId: user._id, voucherId: voucher._id, planId: args.planId,
      walletTransactionId: walletTxId, amount: plan.price, reference, status: "completed",
      createdAt: new Date().toISOString(),
    });
    await ctx.db.patch(voucher._id, { status: "sold", soldToUserId: user._id, soldAt: new Date().toISOString(), purchaseId });
    return { purchaseId, username: voucher.username, password: voucher.password, planName: plan.name, amount: plan.price };
  },
});

export const getMyPurchases = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) return [];
    const purchases = await ctx.db.query("purchases").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(50);
    return await Promise.all(purchases.map(async (p) => {
      const [voucher, plan] = await Promise.all([ctx.db.get(p.voucherId), ctx.db.get(p.planId)]);
      return { ...p, voucher: voucher ? { username: voucher.username, password: voucher.password } : null, planName: plan?.name ?? "Unknown Plan", durationLabel: plan?.durationLabel ?? "" };
    }));
  },
});

export const listAllPurchases = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);
    const purchases = await ctx.db.query("purchases").order("desc").take(200);
    return await Promise.all(purchases.map(async (p) => {
      const [purchaseUser, voucher, plan] = await Promise.all([ctx.db.get(p.userId), ctx.db.get(p.voucherId), ctx.db.get(p.planId)]);
      return { ...p, userName: purchaseUser?.name ?? purchaseUser?.email ?? "Unknown", userEmail: purchaseUser?.email, voucherUsername: voucher?.username ?? "", planName: plan?.name ?? "Unknown" };
    }));
  },
});

export const deleteVoucher = mutation({
  args: { voucherId: v.id("vouchers") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdminMutation(ctx);
    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new ConvexError({ code: "NOT_FOUND", message: "Voucher not found" });
    if (voucher.status === "sold") throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot delete a sold voucher" });
    await ctx.db.delete(args.voucherId);
    return null;
  },
});

export const listVouchersAdminRich = query({
  args: { planId: v.optional(v.id("voucherPlans")), status: v.optional(v.union(v.literal("available"), v.literal("reserved"), v.literal("sold"), v.literal("disabled"))) },
  handler: async (ctx, args) => {
    await requireAdminQuery(ctx);
    let vouchers;
    if (args.planId && args.status) {
      vouchers = await ctx.db.query("vouchers").withIndex("by_plan_and_status", (q) => q.eq("planId", args.planId!).eq("status", args.status!)).take(300);
    } else if (args.planId) {
      vouchers = await ctx.db.query("vouchers").withIndex("by_plan", (q) => q.eq("planId", args.planId!)).take(300);
    } else if (args.status) {
      vouchers = await ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", args.status!)).take(300);
    } else {
      vouchers = await ctx.db.query("vouchers").order("desc").take(300);
    }
    const plans = await ctx.db.query("voucherPlans").collect();
    const planMap = new Map(plans.map(p => [p._id as string, p.name]));
    return vouchers.map(v => ({
      _id: v._id, username: v.username, planId: v.planId,
      planName: planMap.get(v.planId as string) ?? "Unknown",
      status: v.status, importBatchId: v.importBatchId, soldAt: v.soldAt, soldToUserId: v.soldToUserId,
    }));
  },
});

export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);
    const [allUsers, allPurchases, available, sold, disabled] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("purchases").collect(),
      ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", "available")).collect(),
      ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", "sold")).collect(),
      ctx.db.query("vouchers").withIndex("by_status", (q) => q.eq("status", "disabled")).collect(),
    ]);
    const totalRevenue = allPurchases.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todaySales = allPurchases.filter(p => new Date(p.createdAt) >= today);
    const todayRevenue = todaySales.reduce((s, p) => s + p.amount, 0);
    return { totalUsers: allUsers.length, totalPurchases: allPurchases.length, totalRevenue, availableVouchers: available.length, soldVouchers: sold.length, disabledVouchers: disabled.length, todaySales: todaySales.length, todayRevenue };
  },
});

export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);
    const users = await ctx.db.query("users").order("desc").take(200);
    return await Promise.all(users.map(async (u) => {
      const wallet = await ctx.db.query("wallets").withIndex("by_user", (q) => q.eq("userId", u._id)).unique();
      const purchaseCount = (await ctx.db.query("purchases").withIndex("by_user", (q) => q.eq("userId", u._id)).collect()).length;
      return { ...u, walletBalance: wallet?.balance ?? 0, purchaseCount };
    }));
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("user"), v.literal("admin")) },
  handler: async (ctx, args): Promise<null> => {
    await requireAdminMutation(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
    return null;
  },
});

export const seedDefaultPlans = internalMutation({
  args: {},
  handler: async (ctx): Promise<null> => {
    const existing = await ctx.db.query("voucherPlans").collect();
    if (existing.length > 0) return null;
    const plans = [
      { name: "1 Hour", durationLabel: "1 Hour Access", durationHours: 1, price: 200, popular: false, active: true, sortOrder: 1 },
      { name: "3 Hours", durationLabel: "3 Hours Access", durationHours: 3, price: 500, popular: false, active: true, sortOrder: 2 },
      { name: "12 Hours", durationLabel: "12 Hours Access", durationHours: 12, price: 800, popular: false, active: true, sortOrder: 3 },
      { name: "1 Day", durationLabel: "24 Hours Access", durationHours: 24, price: 1500, popular: true, active: true, sortOrder: 4 },
      { name: "3 Days", durationLabel: "72 Hours Access", durationHours: 72, price: 3500, popular: false, active: true, sortOrder: 5 },
      { name: "7 Days", durationLabel: "7 Days Access", durationHours: 168, price: 7000, popular: false, active: true, sortOrder: 6 },
    ];
    for (const plan of plans) { await ctx.db.insert("voucherPlans", plan); }
    return null;
  },
});
