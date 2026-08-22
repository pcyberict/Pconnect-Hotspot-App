import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("pconnect_user_role", ["user", "admin"]);
export const walletTransactionType = pgEnum("pconnect_wallet_tx_type", ["deposit", "purchase"]);
export const walletTransactionStatus = pgEnum("pconnect_wallet_tx_status", ["pending", "successful", "failed"]);
export const voucherStatus = pgEnum("pconnect_voucher_status", ["available", "reserved", "sold", "disabled"]);
export const purchaseStatus = pgEnum("pconnect_purchase_status", ["completed", "refunded"]);

export const users = pgTable("pconnect_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenIdentifier: text("token_identifier").notNull(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  role: userRole("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex("pconnect_users_token_idx").on(table.tokenIdentifier),
}));

export const wallets = pgTable("pconnect_wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  balance: doublePrecision("balance").notNull().default(0),
}, (table) => ({
  userIdx: uniqueIndex("pconnect_wallets_user_idx").on(table.userId),
}));

export const voucherPlans = pgTable("pconnect_voucher_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  durationLabel: text("duration_label").notNull(),
  durationHours: integer("duration_hours").notNull(),
  price: doublePrecision("price").notNull(),
  dataLimit: text("data_limit"),
  description: text("description"),
  features: jsonb("features").$type<{ icon: string; text: string }[]>(),
  popular: boolean("popular").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vouchers = pgTable("pconnect_vouchers", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").notNull().references(() => voucherPlans.id),
  username: text("username").notNull(),
  password: text("password").notNull(),
  status: voucherStatus("status").notNull().default("available"),
  importBatchId: text("import_batch_id"),
  notes: text("notes"),
  soldToUserId: uuid("sold_to_user_id").references(() => users.id),
  soldAt: timestamp("sold_at", { withTimezone: true }),
  purchaseId: uuid("purchase_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  usernameIdx: uniqueIndex("pconnect_vouchers_username_idx").on(table.username),
}));

export const walletTransactions = pgTable("pconnect_wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  type: walletTransactionType("type").notNull(),
  amount: doublePrecision("amount").notNull(),
  previousBalance: doublePrecision("previous_balance").notNull(),
  newBalance: doublePrecision("new_balance").notNull(),
  status: walletTransactionStatus("status").notNull(),
  reference: text("reference").notNull(),
  provider: text("provider"),
  providerTransactionId: text("provider_transaction_id"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paymentChannel: text("payment_channel"),
  virtualAccount: jsonb("virtual_account").$type<{
    accountNumber: string; bankName: string; accountName: string; expiresAt: string; orderRef?: string;
  }>(),
}, (table) => ({
  referenceIdx: uniqueIndex("pconnect_wallet_transactions_reference_idx").on(table.reference),
}));

export const purchases = pgTable("pconnect_purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  voucherId: uuid("voucher_id").notNull().references(() => vouchers.id),
  planId: uuid("plan_id").notNull().references(() => voucherPlans.id),
  walletTransactionId: uuid("wallet_transaction_id").notNull().references(() => walletTransactions.id),
  amount: doublePrecision("amount").notNull(),
  reference: text("reference").notNull(),
  status: purchaseStatus("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable("pconnect_site_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (table) => ({
  keyIdx: uniqueIndex("pconnect_site_settings_key_idx").on(table.key),
}));