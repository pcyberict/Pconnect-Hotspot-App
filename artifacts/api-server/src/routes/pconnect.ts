import { Router } from "express";
import { pool } from "@workspace/db";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const router = Router();
const tokenFor = (req: { headers: Record<string, string | string[] | undefined> }) =>
  typeof req.headers["x-pconnect-token"] === "string" ? req.headers["x-pconnect-token"] : "";

async function currentUser(token: string) {
  const result = await pool.query("SELECT * FROM pconnect_users WHERE token_identifier = $1", [token]);
  return result.rows[0] as Record<string, unknown> | undefined;
}

function withId(row: Record<string, unknown>) {
  return { ...row, _id: row.id, _creationTime: row.created_at };
}

function publicUser(row: Record<string, unknown>) {
  const { password_hash: _passwordHash, ...safe } = row;
  return withId(safe);
}

function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}

function databaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /relation .* does not exist|database .* does not exist|schema .* does not exist/i.test(message)
    ? "Database schema is not initialized. Run the database schema setup first."
    : "The database could not complete this request";
}

router.post("/auth/register", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const phone = String(req.body?.phone ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and a password of at least 6 characters are required" });
  }
  try {
    const token = randomUUID();
    const result = await pool.query(`INSERT INTO pconnect_users
      (token_identifier,name,email,phone,password_hash,role)
      VALUES ($1,$2,$3,$4,$5,'user') RETURNING *`,
      [token, name, email, phone || null, passwordHash(password)]);
    await pool.query("INSERT INTO pconnect_wallets (user_id,balance) VALUES ($1,0)", [result.rows[0].id]);
    return res.status(201).json({ token, user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate")) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    return res.status(503).json({ error: databaseErrorMessage(error) });
  }
});

router.post("/auth/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  try {
    const result = await pool.query("SELECT * FROM pconnect_users WHERE lower(email)=lower($1) LIMIT 1", [email]);
    const user = result.rows[0] as Record<string, unknown> | undefined;
    // The imported demo records predate password hashes; bootstrap them once with the documented demo password.
    const valid = user && (passwordMatches(password, user.password_hash as string | null) ||
      (!user.password_hash && email === "demo@pconnect.local" && password === "demo1234"));
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const token = randomUUID();
    const updated = await pool.query("UPDATE pconnect_users SET token_identifier=$1, password_hash=COALESCE(password_hash,$2) WHERE id=$3 RETURNING *",
      [token, passwordHash(password), user.id]);
    return res.json({ token, user: publicUser(updated.rows[0]) });
  } catch (error) {
    return res.status(503).json({ error: databaseErrorMessage(error) });
  }
});

router.get("/plans", async (_req, res) => {
  const result = await pool.query(`
    SELECT p.*, COUNT(v.id) FILTER (WHERE v.status = 'available')::int AS "availableCount",
      COUNT(v.id) FILTER (WHERE v.status = 'sold')::int AS "soldCount",
      COUNT(v.id) FILTER (WHERE v.status = 'disabled')::int AS "disabledCount"
    FROM pconnect_voucher_plans p LEFT JOIN pconnect_vouchers v ON v.plan_id = p.id
    WHERE p.active = true GROUP BY p.id ORDER BY p.sort_order`);
  res.json(result.rows.map(withId));
});

router.use("/admin", async (req, res, next) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(401).json({ error: "Authentication required" });
  if (user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  return next();
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
    const durationHours = Number(plan.durationHours);
    const price = Number(plan.price);
    const sortOrder = Number(plan.sortOrder ?? 0);
    const features = Array.isArray(plan.features) ? JSON.stringify(plan.features) : null;
    if (!String(plan.name ?? "").trim() || !String(plan.durationLabel ?? "").trim() ||
        !Number.isInteger(durationHours) || durationHours <= 0 ||
        !Number.isFinite(price) || price < 0 || !Number.isInteger(sortOrder)) {
      return res.status(400).json({ error: "Plan name, duration, price, and sort order must be valid" });
    }
    if (plan.id) {
      const result = await pool.query(`UPDATE pconnect_voucher_plans SET
        name=COALESCE($1,name), duration_label=COALESCE($2,duration_label),
        duration_hours=COALESCE($3,duration_hours), price=COALESCE($4,price),
        data_limit=$5, description=$6, features=$7, popular=COALESCE($8,popular),
        active=COALESCE($9,active), sort_order=COALESCE($10,sort_order)
        WHERE id=$11 RETURNING *`,
        [String(plan.name).trim(), String(plan.durationLabel).trim(), durationHours, price, plan.dataLimit || null,
          plan.description || null, features, Boolean(plan.popular), plan.active !== false, sortOrder, plan.id]);
      return res.json(withId(result.rows[0]));
    }
    const result = await pool.query(`INSERT INTO pconnect_voucher_plans
      (name,duration_label,duration_hours,price,data_limit,description,features,popular,active,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [String(plan.name).trim(), String(plan.durationLabel).trim(), durationHours, price, plan.dataLimit || null,
        plan.description || null, features, Boolean(plan.popular), plan.active !== false, sortOrder]);
    return res.json(withId(result.rows[0]));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Plan could not be saved" });
  }
});

router.get("/me", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(publicUser(user));
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

router.get("/notifications", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.json({ items: [], unreadCount: 0 });
  const result = await pool.query(
    `SELECT id, title, message, type, read_at, created_at
     FROM pconnect_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [user.id],
  );
  return res.json({
    items: result.rows.map(withId),
    unreadCount: result.rows.filter((row) => !row.read_at).length,
  });
});

router.post("/notifications/read", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(401).json({ error: "Not logged in" });
  await pool.query(
    "UPDATE pconnect_notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2",
    [req.body?.notificationId, user.id],
  );
  return res.json({ ok: true });
});

router.post("/notifications/read-all", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(401).json({ error: "Not logged in" });
  await pool.query("UPDATE pconnect_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [user.id]);
  return res.json({ ok: true });
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
  return res.json(publicUser(result.rows[0]));
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
  const result = await pool.query(`SELECT u.*, w.balance AS "walletBalance",
    (SELECT COUNT(*)::int FROM pconnect_purchases p WHERE p.user_id=u.id) AS "purchaseCount"
    FROM pconnect_users u LEFT JOIN pconnect_wallets w ON w.user_id=u.id
    ORDER BY u.created_at DESC LIMIT 200`);
  res.json(result.rows.map(withId));
});

router.post("/admin/users", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const phone = String(req.body?.phone ?? "").trim();
  const password = String(req.body?.password ?? "");
  const role = req.body?.role === "admin" ? "admin" : req.body?.role === "user" ? "user" : null;

  if (!name || !email || !password || password.length < 6 || !role) {
    return res.status(400).json({ error: "Name, email, password of at least 6 characters, and a valid role are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`INSERT INTO pconnect_users
      (token_identifier,name,email,phone,password_hash,role)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [randomUUID(), name, email, phone || null, passwordHash(password), role]);
    await client.query("INSERT INTO pconnect_wallets (user_id,balance) VALUES ($1,0)", [result.rows[0].id]);
    await client.query("COMMIT");
    return res.status(201).json({ ...withId(result.rows[0]), walletBalance: 0, purchaseCount: 0 });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Error && error.message.includes("duplicate")) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    return res.status(400).json({ error: "User could not be created" });
  } finally {
    client.release();
  }
});

router.post("/admin/users/role", async (req, res) => {
  const role = req.body?.role === "admin" ? "admin" : req.body?.role === "user" ? "user" : null;
  if (!role || typeof req.body?.userId !== "string") {
    return res.status(400).json({ error: "A valid user and role are required" });
  }
  const result = await pool.query("UPDATE pconnect_users SET role=$1 WHERE id=$2 RETURNING *", [role, req.body.userId]);
  if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
  return res.json(withId(result.rows[0]));
});

router.post("/admin/users/delete", async (req, res) => {
  const userId = req.body?.userId;
  if (typeof userId !== "string") return res.status(400).json({ error: "A valid user is required" });

  const admin = await currentUser(tokenFor(req));
  if (admin?.id === userId) {
    return res.status(400).json({ error: "You cannot delete your own admin account" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = (await client.query("SELECT id FROM pconnect_users WHERE id=$1 FOR UPDATE", [userId])).rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    // Keep vouchers in inventory while removing the account and its history.
    await client.query("UPDATE pconnect_vouchers SET sold_to_user_id=NULL WHERE sold_to_user_id=$1", [userId]);
    await client.query("DELETE FROM pconnect_purchases WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM pconnect_wallet_transactions WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM pconnect_wallets WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM pconnect_users WHERE id=$1", [userId]);
    await client.query("COMMIT");
    return res.json({ deleted: true, userId });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/admin/users/manual-funding", async (req, res) => {
  const userId = String(req.body?.userId ?? "");
  const amount = Number(req.body?.amount);
  if (!userId || !Number.isFinite(amount) || amount <= 0 || amount > 5000000) {
    return res.status(400).json({ error: "Select a user and enter a valid amount" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = (await client.query("SELECT id, name, email FROM pconnect_users WHERE id=$1", [userId])).rows[0];
    const wallet = (await client.query("SELECT * FROM pconnect_wallets WHERE user_id=$1 FOR UPDATE", [userId])).rows[0];
    if (!user || !wallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User wallet not found" });
    }
    const previousBalance = Number(wallet.balance);
    const newBalance = previousBalance + amount;
    const reference = `pcc-manual-${randomUUID()}`;
    await client.query(`INSERT INTO pconnect_wallet_transactions
      (user_id,wallet_id,type,amount,previous_balance,new_balance,status,reference,provider,description)
      VALUES ($1,$2,'manual_funding',$3,$4,$5,'successful',$6,'admin','Manual funding by admin')`,
      [userId, wallet.id, amount, previousBalance, newBalance, reference]);
    await client.query("UPDATE pconnect_wallets SET balance=$1 WHERE id=$2", [newBalance, wallet.id]);
    await client.query(`INSERT INTO pconnect_notifications (user_id, title, message, type)
      VALUES ($1, 'Wallet funded', $2, 'wallet')`,
      [userId, `${amount.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })} Manual funding by admin`]);
    await client.query("COMMIT");
    return res.json({ userId, amount, balance: newBalance, reference });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Manual funding failed" });
  } finally {
    client.release();
  }
});

router.get("/admin/inventory/counts", async (_req, res) => {
  const result = await pool.query(`SELECT
    COUNT(*) FILTER (WHERE status = 'available')::int AS available,
    COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved,
    COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
    COUNT(*) FILTER (WHERE status = 'disabled')::int AS disabled
    FROM pconnect_vouchers`);
  res.json(result.rows[0]);
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
  const planId = String(req.body?.planId ?? "").trim();
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "").trim();
  if (!planId || !username || !password) {
    return res.status(400).json({ error: "Plan, username, and password are required" });
  }
  try {
    const plan = await pool.query("SELECT id FROM pconnect_voucher_plans WHERE id=$1", [planId]);
    if (!plan.rows[0]) {
      return res.status(400).json({ error: "The selected plan no longer exists. Refresh and select a valid plan." });
    }
    const result = await pool.query(`INSERT INTO pconnect_vouchers (plan_id,username,password,status,notes)
      VALUES ($1,$2,$3,'available',$4) RETURNING *`, [planId, username, password, req.body?.notes || null]);
    return res.json(result.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("pconnect_vouchers_username_idx") || message.includes("duplicate key")) {
      return res.status(409).json({ error: `A voucher with username "${username}" already exists. Use a unique username.` });
    }
    if (message.includes("foreign key")) {
      return res.status(400).json({ error: "The selected plan no longer exists. Refresh and select a valid plan." });
    }
    return res.status(400).json({ error: "Voucher could not be added" });
  }
});

router.post("/admin/inventory/import", async (req, res) => {
  const batch = req.body?.importBatchId ?? `batch-${Date.now()}`;
  const planId = String(req.body?.planId ?? "").trim();
  const vouchers = Array.isArray(req.body?.vouchers) ? req.body.vouchers : [];
  if (!planId) return res.status(400).json({ error: "Select a valid plan before importing vouchers" });
  if (vouchers.length === 0) return res.status(400).json({ error: "Add at least one voucher row to import" });
  const plan = await pool.query("SELECT id FROM pconnect_voucher_plans WHERE id=$1", [planId]);
  if (!plan.rows[0]) return res.status(400).json({ error: "The selected plan no longer exists. Refresh and select a valid plan." });

  let inserted = 0;
  let skipped = 0;
  for (const item of vouchers) {
    const username = String(item?.username ?? "").trim();
    const password = String(item?.password ?? "").trim();
    if (!username || !password) { skipped++; continue; }
    const result = await pool.query(`INSERT INTO pconnect_vouchers (plan_id,username,password,status,import_batch_id)
      VALUES ($1,$2,$3,'available',$4) ON CONFLICT (username) DO NOTHING`, [planId, username, password, String(batch)]);
    if (result.rowCount) inserted++; else skipped++;
  }
  return res.json({ inserted, skipped });
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
  await pool.query(
    `INSERT INTO pconnect_notifications (user_id, title, message, type)
     VALUES ($1, 'Wallet funding pending', $2, 'wallet')`,
    [user.id, `Your ${amount.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })} wallet funding request is being processed.`],
  );
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