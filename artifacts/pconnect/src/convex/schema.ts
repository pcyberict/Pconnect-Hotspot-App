import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  }).index("by_token", ["tokenIdentifier"]),

  wallets: defineTable({
    userId: v.id("users"),
    balance: v.number(),
  }).index("by_user", ["userId"]),

  walletTransactions: defineTable({
    userId: v.id("users"),
    walletId: v.id("wallets"),
    type: v.union(v.literal("deposit"), v.literal("purchase")),
    amount: v.number(),
    previousBalance: v.number(),
    newBalance: v.number(),
    status: v.union(v.literal("pending"), v.literal("successful"), v.literal("failed")),
    reference: v.string(),
    provider: v.optional(v.string()),
    providerTransactionId: v.optional(v.string()),
    description: v.optional(v.string()),
    createdAt: v.string(),
    paymentChannel: v.optional(v.string()),
    virtualAccount: v.optional(v.object({
      accountNumber: v.string(),
      bankName: v.string(),
      accountName: v.string(),
      expiresAt: v.string(),
      orderRef: v.optional(v.string()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_reference", ["reference"])
    .index("by_provider_transaction_id", ["providerTransactionId"]),

  voucherPlans: defineTable({
    name: v.string(),
    durationLabel: v.string(),
    durationHours: v.number(),
    price: v.number(),
    dataLimit: v.optional(v.string()),
    description: v.optional(v.string()),
    features: v.optional(v.array(v.object({ icon: v.string(), text: v.string() }))),
    popular: v.boolean(),
    active: v.boolean(),
    sortOrder: v.number(),
  }).index("by_active", ["active"]),

  vouchers: defineTable({
    planId: v.id("voucherPlans"),
    username: v.string(),
    password: v.string(),
    status: v.union(v.literal("available"), v.literal("reserved"), v.literal("sold"), v.literal("disabled")),
    importBatchId: v.optional(v.string()),
    notes: v.optional(v.string()),
    soldToUserId: v.optional(v.id("users")),
    soldAt: v.optional(v.string()),
    purchaseId: v.optional(v.id("purchases")),
  })
    .index("by_plan", ["planId"])
    .index("by_status", ["status"])
    .index("by_plan_and_status", ["planId", "status"])
    .index("by_username", ["username"])
    .index("by_sold_user", ["soldToUserId"]),

  purchases: defineTable({
    userId: v.id("users"),
    voucherId: v.id("vouchers"),
    planId: v.id("voucherPlans"),
    walletTransactionId: v.id("walletTransactions"),
    amount: v.number(),
    reference: v.string(),
    status: v.union(v.literal("completed"), v.literal("refunded")),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_reference", ["reference"])
    .index("by_plan", ["planId"]),

  siteSettings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});
