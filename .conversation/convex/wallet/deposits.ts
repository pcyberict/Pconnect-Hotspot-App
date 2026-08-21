import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel.d.ts";

const MIN_DEPOSIT_NAIRA = 100;
const MAX_DEPOSIT_NAIRA = 500_000;

async function getFlutterwaveSecretKey(ctx: ActionCtx): Promise<string> {
  const dbKey = await ctx.runQuery(api.siteSettings.getValueInternal, { key: "flutterwave_secret_key" });
  const key = dbKey ?? process.env.FLUTTERWAVE_SECRET_KEY ?? "";
  if (!key) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Flutterwave secret key is not configured. Add it in Admin → Settings." });
  return key;
}

export const createPendingDeposit = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args): Promise<{ reference: string; amount: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    if (!Number.isFinite(args.amount) || args.amount < MIN_DEPOSIT_NAIRA || args.amount > MAX_DEPOSIT_NAIRA) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Enter an amount between ₦${MIN_DEPOSIT_NAIRA} and ₦${MAX_DEPOSIT_NAIRA.toLocaleString()}` });
    }
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const wallet = await ctx.db.query("wallets").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (!wallet) throw new ConvexError({ code: "NOT_FOUND", message: "Wallet not found" });
    const reference = `pcc-${user._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await ctx.db.insert("walletTransactions", {
      userId: user._id, walletId: wallet._id, type: "deposit", amount: args.amount,
      previousBalance: wallet.balance, newBalance: wallet.balance, status: "pending",
      reference, provider: "flutterwave", description: "Wallet funding via Flutterwave",
      createdAt: new Date().toISOString(),
    });
    return { reference, amount: args.amount };
  },
});

export const getDepositByReference = internalQuery({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("walletTransactions").withIndex("by_reference", (q) => q.eq("reference", args.reference)).unique();
  },
});

export const getDepositByProviderTransactionId = internalQuery({
  args: { providerTransactionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("walletTransactions").withIndex("by_provider_transaction_id", (q) => q.eq("providerTransactionId", args.providerTransactionId)).unique();
  },
});

export const finalizeDeposit = internalMutation({
  args: { reference: v.string(), providerTransactionId: v.string(), verifiedAmount: v.number(), outcome: v.union(v.literal("successful"), v.literal("failed")) },
  handler: async (ctx, args): Promise<null> => {
    const transaction = await ctx.db.query("walletTransactions").withIndex("by_reference", (q) => q.eq("reference", args.reference)).unique();
    if (!transaction || transaction.status !== "pending") return null;
    if (args.outcome === "failed") {
      await ctx.db.patch(transaction._id, { status: "failed", providerTransactionId: args.providerTransactionId });
      return null;
    }
    if (args.verifiedAmount < transaction.amount) {
      await ctx.db.patch(transaction._id, { status: "failed", providerTransactionId: args.providerTransactionId, description: "Amount mismatch during verification" });
      return null;
    }
    const wallet = await ctx.db.get(transaction.walletId);
    if (!wallet) return null;
    const newBalance = wallet.balance + transaction.amount;
    await ctx.db.patch(wallet._id, { balance: newBalance });
    await ctx.db.patch(transaction._id, { status: "successful", providerTransactionId: args.providerTransactionId, previousBalance: wallet.balance, newBalance });
    return null;
  },
});

export const verifyAndFinalizeDeposit = action({
  args: { providerTransactionId: v.string() },
  handler: async (ctx, args): Promise<{ status: string }> => {
    const secretKey = await getFlutterwaveSecretKey(ctx);
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${args.providerTransactionId}/verify`, { headers: { Authorization: `Bearer ${secretKey}` } });
    if (!response.ok) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Failed to verify transaction with Flutterwave" });
    const body = (await response.json()) as { status: string; data?: { status: string; amount: number; currency: string; tx_ref: string; id: number } };
    if (body.status !== "success" || !body.data) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Invalid verification response" });
    const { data } = body;
    const outcome = data.status === "successful" && data.currency === "NGN" ? "successful" : "failed";
    await ctx.runMutation(internal.wallet.deposits.finalizeDeposit, { reference: data.tx_ref, providerTransactionId: String(data.id), verifiedAmount: data.amount, outcome });
    return { status: outcome };
  },
});

export const createCheckoutLink = action({
  args: { reference: v.string(), redirectUrl: v.string() },
  handler: async (ctx, args): Promise<{ link: string }> => {
    const secretKey = await getFlutterwaveSecretKey(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    const deposit = await ctx.runQuery(internal.wallet.deposits.getDepositByReference, { reference: args.reference });
    if (!deposit || deposit.status !== "pending") throw new ConvexError({ code: "NOT_FOUND", message: "Deposit request not found" });
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tx_ref: args.reference, amount: deposit.amount, currency: "NGN", redirect_url: args.redirectUrl, customer: { email: identity.email ?? "customer@pcyberict.com", name: identity.name ?? "PCyber Connect Customer" }, customizations: { title: "PCyber Connect Wallet Funding", description: "Fund your PCyber Connect wallet" }, meta: { userId: deposit.userId as Id<"users"> } }),
    });
    if (!response.ok) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Failed to start Flutterwave checkout" });
    const body = (await response.json()) as { status: string; data?: { link: string } };
    if (body.status !== "success" || !body.data?.link) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Flutterwave did not return a checkout link" });
    return { link: body.data.link };
  },
});

export const getMyDepositHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) return [];
    return await ctx.db.query("walletTransactions").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(50);
  },
});

export const verifyDepositById = action({
  args: { reference: v.string(), providerTransactionId: v.string() },
  handler: async (ctx, args): Promise<{ status: string }> => {
    const secretKey = await getFlutterwaveSecretKey(ctx);
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${args.providerTransactionId}/verify`, { headers: { Authorization: `Bearer ${secretKey}` } });
    if (!response.ok) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Failed to verify transaction" });
    const body = (await response.json()) as { status: string; data?: { status: string; amount: number; currency: string; tx_ref: string; id: number } };
    if (body.status !== "success" || !body.data) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Invalid verification response" });
    const { data } = body;
    const outcome = data.status === "successful" && data.currency === "NGN" ? "successful" : "failed";
    await ctx.runMutation(internal.wallet.deposits.finalizeDeposit, { reference: args.reference, providerTransactionId: String(data.id), verifiedAmount: data.amount, outcome });
    return { status: outcome };
  },
});

export const createVirtualAccount = action({
  args: { reference: v.string() },
  handler: async (ctx, args): Promise<{ accountNumber: string; bankName: string; accountName: string; expiresAt: string; orderRef?: string }> => {
    const secretKey = await getFlutterwaveSecretKey(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const deposit = await ctx.runQuery(internal.wallet.deposits.getDepositByReference, { reference: args.reference });
    if (!deposit || deposit.status !== "pending") throw new ConvexError({ code: "NOT_FOUND", message: "Deposit not found" });
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const payload = { email: identity.email ?? "customer@pcyberict.com", duration: 30, frequency: 1, amount: deposit.amount, currency: "NGN", tx_ref: args.reference, narration: "PCyber Connect Wallet Funding", is_permanent: false };
    const response = await fetch("https://api.flutterwave.com/v3/virtual-account-numbers", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Could not create virtual account. Try card payment instead." });
    const body = (await response.json()) as { status: string; data?: { account_number: string; bank_name: string; account_name?: string; order_ref?: string } };
    if (body.status !== "success" || !body.data) throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Virtual account creation failed. Try card payment instead." });
    const { data } = body;
    const virtualAccount = { accountNumber: data.account_number, bankName: data.bank_name, accountName: data.account_name ?? "PCyber Connect", expiresAt, orderRef: data.order_ref };
    await ctx.runMutation(internal.wallet.deposits.saveVirtualAccount, { reference: args.reference, virtualAccount });
    return virtualAccount;
  },
});

export const pollBankTransfer = action({
  args: { reference: v.string() },
  handler: async (ctx, args): Promise<{ status: "successful" | "pending" | "failed" }> => {
    const secretKey = await getFlutterwaveSecretKey(ctx);
    const deposit = await ctx.runQuery(internal.wallet.deposits.getDepositByReference, { reference: args.reference });
    if (!deposit) throw new ConvexError({ code: "NOT_FOUND", message: "Deposit not found" });
    if (deposit.status === "successful") return { status: "successful" };
    if (deposit.status === "failed") return { status: "failed" };
    const response = await fetch(`https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(args.reference)}`, { headers: { Authorization: `Bearer ${secretKey}` } });
    if (!response.ok) return { status: "pending" };
    const body = (await response.json()) as { status: string; data?: { status: string; amount: number; currency: string; id: number }[] };
    if (body.status !== "success" || !body.data?.length) return { status: "pending" };
    const tx = body.data[0];
    if (!tx) return { status: "pending" };
    if (tx.status === "successful" && tx.currency === "NGN") {
      await ctx.runMutation(internal.wallet.deposits.finalizeDeposit, { reference: args.reference, providerTransactionId: String(tx.id), verifiedAmount: tx.amount, outcome: "successful" });
      return { status: "successful" };
    }
    return { status: "pending" };
  },
});

export const saveVirtualAccount = internalMutation({
  args: { reference: v.string(), virtualAccount: v.object({ accountNumber: v.string(), bankName: v.string(), accountName: v.string(), expiresAt: v.string(), orderRef: v.optional(v.string()) }) },
  handler: async (ctx, args): Promise<null> => {
    const tx = await ctx.db.query("walletTransactions").withIndex("by_reference", (q) => q.eq("reference", args.reference)).unique();
    if (!tx) return null;
    await ctx.db.patch(tx._id, { virtualAccount: args.virtualAccount, paymentChannel: "bank_transfer" });
    return null;
  },
});
