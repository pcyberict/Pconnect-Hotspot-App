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

router.get("/admin/plans", async (_req, res) => {
  const result = await pool.query(`SELECT p.*,
    COUNT(v.id) FILTER (WHERE v.status = 'available')::int AS "availableCount",
    COUNT(v.id) FILTER (WHERE v.status = 'sold')::int AS "soldCount",
    COUNT(v.id) FILTER (WHERE v.status = 'disabled')::int AS "disabledCount"
    FROM pconnect_voucher_plans p LEFT JOIN pconnect_vouchers v ON v.plan_id=p.id
    GROUP BY p.id ORDER BY p.sort_order`);
  res.json(result.rows.map(withId));
});

router.post("/admin/plans", async (req, res) => {
  const plan = req.body ?? {};
  try {
    if (plan.id) {
      const result = await pool.query(`UPDATE pconnect_voucher_plans SET
        name=COALESCE($1,name), duration_label=COALESCE($2,duration_label),
        duration_hours=COALESCE($3,duration_hours), price=COALESCE($4,price),
        data_limit=$5, description=$6, features=$7, popular=COALESCE($8,popular),
        active=COALESCE($9,active), sort_order=COALESCE($10,sort_order)
        WHERE id=$11 RETURNING *`,
        [plan.name, plan.durationLabel, plan.durationHours, plan.price, plan.dataLimit || null,
          plan.description || null, plan.features ?? null, plan.popular, plan.active, plan.sortOrder, plan.id]);
      return res.json(withId(result.rows[0]));
    }
    const result = await pool.query(`INSERT INTO pconnect_voucher_plans
      (name,duration_label,duration_hours,price,data_limit,description,features,popular,active,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [plan.name, plan.durationLabel, plan.durationHours, plan.price, plan.dataLimit || null,
        plan.description || null, plan.features ?? null, Boolean(plan.popular), plan.active !== false, plan.sortOrder ?? 0]);
    return res.json(withId(result.rows[0]));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Plan could not be saved" });
  }
});

router.get("/me", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(withId(user));
});

router.get("/wallet", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.json(null);
  const result = await pool.query("SELECT * FROM pconnect_wallets WHERE user_id = $1", [user.id]);
  return res.json(result.rows[0] ? withId(result.rows[0]) : null);
});

router.get("/deposits", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.json([]);
  const result = await pool.query("SELECT * FROM pconnect_wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [user.id]);
  return res.json(result.rows.map(withId));
});

router.post("/users/sync", async (req, res) => {
  const token = tokenFor(req);
  const result = await pool.query(`INSERT INTO pconnect_users (token_identifier,name,email,role)
    VALUES ($1,$2,$3,CASE WHEN NOT EXISTS (SELECT 1 FROM pconnect_users) THEN 'admin' ELSE 'user' END)
    ON CONFLICT (token_identifier) DO UPDATE SET name=COALESCE(EXCLUDED.name,pconnect_users.name),
      email=COALESCE(EXCLUDED.email,pconnect_users.email)
    RETURNING *`, [token, req.body?.name ?? "Demo Customer", req.body?.email ?? "demo@pconnect.local"]);
  await pool.query(`INSERT INTO pconnect_wallets (user_id,balance) VALUES ($1,0) ON CONFLICT (user_id) DO NOTHING`, [result.rows[0].id]);
  res.json(withId(result.rows[0]));
});

router.post("/users/profile", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(404).json({ error: "User not found" });
  const result = await pool.query("UPDATE pconnect_users SET name=COALESCE($1,name), phone=COALESCE($2,phone) WHERE id=$3 RETURNING *",
    [req.body?.name, req.body?.phone, user.id]);
  return res.json(withId(result.rows[0]));
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
  return res.json(result.rows.map((row) => withId({ ...row, voucher: { username: row.voucher_username, password: row.voucher_password }, planName: row.plan_name })));
});

router.get("/admin/purchases", async (_req, res) => {
  const result = await pool.query(`SELECT p.*, u.name AS "userName", u.email AS "userEmail",
    v.username AS "voucherUsername", vp.name AS "planName"
    FROM pconnect_purchases p JOIN pconnect_users u ON u.id=p.user_id
    JOIN pconnect_vouchers v ON v.id=p.voucher_id JOIN pconnect_voucher_plans vp ON vp.id=p.plan_id
    ORDER BY p.created_at DESC LIMIT 200`);
  res.json(result.rows.map(withId));
});

router.get("/admin/users", async (_req, res) => {
  const result = await pool.query(`SELECT u.*, w.balance,
    (SELECT COUNT(*)::int FROM pconnect_purchases p WHERE p.user_id=u.id) AS "purchaseCount"
    FROM pconnect_users u LEFT JOIN pconnect_wallets w ON w.user_id=u.id
    ORDER BY u.created_at DESC LIMIT 200`);
  res.json(result.rows.map(withId));
});

router.post("/admin/users/role", async (req, res) => {
  const result = await pool.query("UPDATE pconnect_users SET role=$1 WHERE id=$2 RETURNING *", [req.body?.role, req.body?.userId]);
  if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
  return res.json(withId(result.rows[0]));
});

router.get("/admin/inventory/counts", async (_req, res) => {
  const result = await pool.query(`SELECT status, COUNT(*)::int AS count FROM pconnect_vouchers GROUP BY status`);
  res.json(Object.fromEntries(result.rows.map((r) => [r.status, r.count])));
});

router.get("/admin/inventory", async (req, res) => {
  const filters: string[] = [];
  const values: unknown[] = [];
  if (req.query.planId) { values.push(req.query.planId); filters.push(`v.plan_id=$${values.length}`); }
  if (req.query.status) { values.push(req.query.status); filters.push(`v.status=$${values.length}`); }
  const result = await pool.query(`SELECT v.id AS "_id", v.username, v.password, v.plan_id AS "planId",
    p.name AS "planName", v.status, v.import_batch_id AS "importBatchId", v.notes,
    v.sold_at AS "soldAt", v.sold_to_user_id AS "soldToUserId"
    FROM pconnect_vouchers v JOIN pconnect_voucher_plans p ON p.id=v.plan_id
    ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY v.created_at DESC LIMIT 300`, values);
  res.json(result.rows);
});

router.post("/admin/inventory/status", async (req, res) => {
  const result = await pool.query("UPDATE pconnect_vouchers SET status=$1 WHERE id=$2 AND status <> 'sold' RETURNING *", [req.body?.status, req.body?.voucherId]);
  if (!result.rows[0]) return res.status(400).json({ error: "Voucher not found or already sold" });
  return res.json(result.rows[0]);
});

router.post("/admin/inventory/delete", async (req, res) => {
  await pool.query("DELETE FROM pconnect_vouchers WHERE id=$1 AND status <> 'sold'", [req.body?.voucherId]);
  res.json(null);
});

router.post("/admin/inventory/create", async (req, res) => {
  try {
    const result = await pool.query(`INSERT INTO pconnect_vouchers (plan_id,username,password,status,notes)
      VALUES ($1,$2,$3,'available',$4) RETURNING *`, [req.body?.planId, String(req.body?.username).trim(), String(req.body?.password).trim(), req.body?.notes || null]);
    return res.json(result.rows[0]);
  } catch { return res.status(400).json({ error: "Username already exists or plan is invalid" }); }
});

router.post("/admin/inventory/import", async (req, res) => {
  const batch = req.body?.importBatchId ?? `batch-${Date.now()}`;
  let inserted = 0; let skipped = 0;
  for (const item of (req.body?.vouchers ?? [])) {
    if (!item.username?.trim() || !item.password?.trim()) { skipped++; continue; }
    const result = await pool.query(`INSERT INTO pconnect_vouchers (plan_id,username,password,status,import_batch_id)
      VALUES ($1,$2,$3,'available',$4) ON CONFLICT (username) DO NOTHING`, [req.body?.planId, item.username.trim(), item.password.trim(), batch]);
    if (result.rowCount) inserted++; else skipped++;
  }
  res.json({ inserted, skipped });
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
    return res.json({ purchaseId: purchase.id, username: voucher.username, password: voucher.password, planName: plan.name, amount: plan.price });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Purchase failed" });
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
  return res.json({ reference, amount });
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

router.get("/settings", async (req, res) => {
  const result = await pool.query("SELECT key, value FROM pconnect_site_settings");
  if (typeof req.query.key === "string") return res.json(result.rows.find((row) => row.key === req.query.key)?.value ?? null);
  return res.json(Object.fromEntries(result.rows.map((row) => [row.key, row.value])));
});

router.get("/settings/public-key", async (_req, res) => {
  const result = await pool.query("SELECT value FROM pconnect_site_settings WHERE key='flutterwave_public_key'");
  res.json(result.rows[0]?.value ?? null);
});

router.get("/settings/masked", async (req, res) => {
  const key = String(req.query.key ?? "");
  const result = await pool.query("SELECT value FROM pconnect_site_settings WHERE key=$1", [key]);
  const value = result.rows[0]?.value as string | undefined;
  res.json(value ? `${value.slice(0, 4)}${"*".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}` : null);
});

router.post("/settings", async (req, res) => {
  const settings = Array.isArray(req.body?.settings) ? req.body.settings : [];
  for (const setting of settings) {
    await pool.query(`INSERT INTO pconnect_site_settings (key,value) VALUES ($1,$2)
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [setting.key, String(setting.value ?? "")]);
  }
  return res.json(null);
});

router.post("/settings/secret", async (req, res) => {
  if (!req.body?.key || !req.body?.value) return res.status(400).json({ error: "Key and value are required" });
  await pool.query(`INSERT INTO pconnect_site_settings (key,value) VALUES ($1,$2)
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [req.body.key, req.body.value]);
  return res.json(null);
});

export default router;