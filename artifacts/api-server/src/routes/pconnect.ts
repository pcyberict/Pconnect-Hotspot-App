import { Router } from "express";
import { pool } from "@workspace/db";
import { randomUUID } from "node:crypto";

const router = Router();
const tokenFor = (req: { headers: Record<string, string | string[] | undefined> }) =>
  typeof req.headers["x-pconnect-token"] === "string" ? req.headers["x-pconnect-token"] : "demo-user";

async function currentUser(token: string) {
  const result = await pool.query("SELECT * FROM pconnect_users WHERE token_identifier = $1", [token]);
  return result.rows[0] as Record<string, unknown> | undefined;
}

function withId(row: Record<string, unknown>) {
  return { ...row, _id: row.id, _creationTime: row.created_at };
}

router.get("/plans", async (_req, res) => {
  const result = await pool.query(`
    SELECT p.*, COUNT(v.id) FILTER (WHERE v.status = 'available')::int AS "availableCount",
      COUNT(v.id) FILTER (WHERE v.status = 'sold')::int AS "soldCount",
      COUNT(v.id) FILTER (WHERE v.status = 'disabled')::int AS "disabledCount"
    FROM pconnect_voucher_plans p LEFT JOIN pconnect_vouchers v ON v.plan_id = p.id
    WHERE p.active = true GROUP BY p.id ORDER BY p.sort_order`);
  res.json(result.rows.map(withId));
});

router.get("/me", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(withId(user));
});

router.get("/wallet", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.json(null);
  const result = await pool.query("SELECT * FROM pconnect_wallets WHERE user_id = $1", [user.id]);
  res.json(result.rows[0] ? withId(result.rows[0]) : null);
});

router.get("/deposits", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.json([]);
  const result = await pool.query("SELECT * FROM pconnect_wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [user.id]);
  res.json(result.rows.map(withId));
});

router.get("/purchases", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.json([]);
  const result = await pool.query(`
    SELECT p.*, v.username AS voucher_username, v.password AS voucher_password,
      vp.name AS plan_name, vp.duration_label
    FROM pconnect_purchases p JOIN pconnect_vouchers v ON v.id = p.voucher_id
    JOIN pconnect_voucher_plans vp ON vp.id = p.plan_id
    WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 50`, [user.id]);
  res.json(result.rows.map((row) => withId({ ...row, voucher: { username: row.voucher_username, password: row.voucher_password }, planName: row.plan_name })));
});

router.post("/purchase", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  const planId = String(req.body?.planId ?? "");
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const plan = (await client.query("SELECT * FROM pconnect_voucher_plans WHERE id = $1 AND active = true", [planId])).rows[0];
    const voucher = (await client.query("SELECT * FROM pconnect_vouchers WHERE plan_id = $1 AND status = 'available' FOR UPDATE SKIP LOCKED LIMIT 1", [planId])).rows[0];
    const wallet = (await client.query("SELECT * FROM pconnect_wallets WHERE user_id = $1 FOR UPDATE", [user.id])).rows[0];
    if (!plan || !voucher) throw new Error("No vouchers available for this plan right now.");
    if (!wallet || Number(wallet.balance) < Number(plan.price)) throw new Error(`Insufficient wallet balance. You need ${plan.price} but have ${wallet?.balance ?? 0}.`);
    const balance = Number(wallet.balance) - Number(plan.price);
    const reference = `pcc-buy-${randomUUID()}`;
    const tx = (await client.query(`INSERT INTO pconnect_wallet_transactions
      (user_id,wallet_id,type,amount,previous_balance,new_balance,status,reference,description)
      VALUES ($1,$2,'purchase',$3,$4,$5,'successful',$6,$7) RETURNING *`,
      [user.id, wallet.id, plan.price, wallet.balance, balance, reference, `Voucher purchase: ${plan.name}`])).rows[0];
    await client.query("UPDATE pconnect_wallets SET balance = $1 WHERE id = $2", [balance, wallet.id]);
    const purchase = (await client.query(`INSERT INTO pconnect_purchases
      (user_id,voucher_id,plan_id,wallet_transaction_id,amount,reference,status)
      VALUES ($1,$2,$3,$4,$5,$6,'completed') RETURNING *`,
      [user.id, voucher.id, plan.id, tx.id, plan.price, reference])).rows[0];
    await client.query("UPDATE pconnect_vouchers SET status = 'sold', sold_to_user_id = $1, sold_at = now(), purchase_id = $2 WHERE id = $3", [user.id, purchase.id, voucher.id]);
    await client.query("COMMIT");
    res.json({ purchaseId: purchase.id, username: voucher.username, password: voucher.password, planName: plan.name, amount: plan.price });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: error instanceof Error ? error.message : "Purchase failed" });
  } finally { client.release(); }
});

router.post("/deposits", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  const amount = Number(req.body?.amount);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  if (!Number.isFinite(amount) || amount < 100 || amount > 500000) return res.status(400).json({ error: "Enter an amount between ₦100 and ₦500,000" });
  const wallet = (await pool.query("SELECT * FROM pconnect_wallets WHERE user_id = $1", [user.id])).rows[0];
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  const reference = `pcc-${randomUUID()}`;
  await pool.query(`INSERT INTO pconnect_wallet_transactions
    (user_id,wallet_id,type,amount,previous_balance,new_balance,status,reference,provider,description)
    VALUES ($1,$2,'deposit',$3,$4,$4,'pending',$5,'flutterwave','Wallet funding via Flutterwave')`,
    [user.id, wallet.id, amount, wallet.balance, reference]);
  res.json({ reference, amount });
});

router.get("/admin/stats", async (_req, res) => {
  const result = await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM pconnect_users) AS "totalUsers",
    (SELECT COUNT(*)::int FROM pconnect_purchases) AS "totalPurchases",
    (SELECT COALESCE(SUM(amount),0) FROM pconnect_purchases WHERE status='completed') AS "totalRevenue",
    (SELECT COUNT(*)::int FROM pconnect_vouchers WHERE status='available') AS "availableVouchers",
    (SELECT COUNT(*)::int FROM pconnect_vouchers WHERE status='sold') AS "soldVouchers",
    (SELECT COUNT(*)::int FROM pconnect_vouchers WHERE status='disabled') AS "disabledVouchers",
    (SELECT COUNT(*)::int FROM pconnect_purchases WHERE created_at >= CURRENT_DATE) AS "todaySales",
    (SELECT COALESCE(SUM(amount),0) FROM pconnect_purchases WHERE created_at >= CURRENT_DATE) AS "todayRevenue"`);
  res.json(result.rows[0]);
});

router.get("/admin/inventory", async (_req, res) => {
  const result = await pool.query(`SELECT v.id AS "_id", v.username, v.plan_id AS "planId",
    p.name AS "planName", v.status, v.import_batch_id AS "importBatchId",
    v.sold_at AS "soldAt", v.sold_to_user_id AS "soldToUserId"
    FROM pconnect_vouchers v JOIN pconnect_voucher_plans p ON p.id=v.plan_id
    ORDER BY v.created_at DESC LIMIT 300`);
  res.json(result.rows);
});

router.get("/settings", async (_req, res) => {
  const result = await pool.query("SELECT key, value FROM pconnect_site_settings");
  res.json(Object.fromEntries(result.rows.map((row) => [row.key, row.value])));
});

export default router;