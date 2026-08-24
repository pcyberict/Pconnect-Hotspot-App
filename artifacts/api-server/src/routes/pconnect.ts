import { Router } from "express";
import { pool } from "@workspace/db";
import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { emailLayout, sendEmail } from "../lib/mailer";
import { getAnalytics } from "../lib/analytics";

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

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const referralCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createReferralCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => referralCodeAlphabet[byte % referralCodeAlphabet.length]).join("");
}

async function creditReferralCommission(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> },
  referredUserId: string,
  depositAmount: number,
  depositTransactionId: string,
) {
  const referral = (await client.query(
    "SELECT * FROM pconnect_referrals WHERE referred_user_id=$1 FOR UPDATE",
    [referredUserId],
  )).rows[0];
  if (!referral || referral.status !== "pending") return;
  const settings = (await client.query(
    "SELECT key,value FROM pconnect_site_settings WHERE key = ANY($1::text[])",
    [["referral_active", "referral_commission_type", "referral_commission_value"]],
  )).rows as { key: string; value: string }[];
  const values = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const active = values.referral_active !== "false";
  const configuredValue = Number(values.referral_commission_value ?? 0);
  const type = values.referral_commission_type === "percentage" ? "percentage" : "flat";
  const commission = type === "percentage" ? depositAmount * configuredValue / 100 : configuredValue;
  if (!active || !Number.isFinite(commission) || commission <= 0) {
    await client.query("UPDATE pconnect_referrals SET first_deposit_amount=$1, status='skipped' WHERE id=$2", [depositAmount, referral.id]);
    return;
  }
  const wallet = (await client.query("SELECT * FROM pconnect_wallets WHERE user_id=$1 FOR UPDATE", [referral.referrer_id])).rows[0];
  if (!wallet) return;
  const previousBalance = Number(wallet.balance);
  const newBalance = previousBalance + commission;
  const reference = `pcc-referral-${randomUUID()}`;
  await client.query(`INSERT INTO pconnect_wallet_transactions
    (user_id,wallet_id,type,amount,previous_balance,new_balance,status,reference,provider,description)
    VALUES ($1,$2,'referral_commission',$3,$4,$5,'successful',$6,'referral',$7)`,
    [referral.referrer_id, wallet.id, commission, previousBalance, newBalance, reference,
      `Referral commission from first deposit of ${depositAmount.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}`]);
  await client.query("UPDATE pconnect_wallets SET balance=$1 WHERE id=$2", [newBalance, wallet.id]);
  await client.query(`UPDATE pconnect_referrals
    SET first_deposit_amount=$1, commission_amount=$2, status='credited',
        first_deposit_transaction_id=$3, credited_at=now()
    WHERE id=$4`, [depositAmount, commission, depositTransactionId, referral.id]);
  await client.query(`INSERT INTO pconnect_notifications (user_id,title,message,type)
    VALUES ($1,'Referral commission credited',$2,'success')`,
    [referral.referrer_id, `${commission.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })} referral commission has been credited to your wallet.`]);
}

function otpCode() {
  return String(randomInt(100000, 1000000));
}

function databaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /relation .* does not exist|database .* does not exist|schema .* does not exist/i.test(message)
    ? "Database schema is not initialized. Run the database schema setup first."
    : "The database could not complete this request";
}

async function flutterwaveSecret() {
  const result = await pool.query("SELECT value FROM pconnect_site_settings WHERE key='flutterwave_secret_key'");
  const secret = String(result.rows[0]?.value ?? "").trim();
  if (!secret) throw new Error("Flutterwave secret key is not configured. Ask an admin to add it in Settings.");
  return secret;
}

async function createFlutterwaveVirtualAccount(user: Record<string, unknown>, identityType: "bvn" | "nin", identityNumber: string) {
  const secret = await flutterwaveSecret();
  const fullName = String(user.name ?? "").trim().split(/\s+/).filter(Boolean);
  const response = await fetch("https://api.flutterwave.com/v3/virtual-account-numbers", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      firstname: fullName[0] ?? "Pconnect",
      lastname: fullName.slice(1).join(" ") || "Customer",
      phonenumber: user.phone ?? undefined,
      tx_ref: `pconnect-va-${user.id}`,
      is_permanent: true,
      narration: String(user.name ?? "Pconnect Customer").trim().slice(0, 35),
      [identityType]: identityNumber,
    }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || body.status !== "success" || !body.data?.account_number) {
    throw new Error(body.message || "Flutterwave could not create the virtual account");
  }
  return {
    accountNumber: String(body.data.account_number),
    bankName: String(body.data.bank_name ?? "Flutterwave"),
    accountName: String(body.data.account_name ?? `${user.name ?? "Pconnect Customer"}`),
    orderRef: body.data.order_ref ? String(body.data.order_ref) : undefined,
    flwRef: body.data.flw_ref ? String(body.data.flw_ref) : undefined,
    createdAt: body.data.created_at ? String(body.data.created_at) : new Date().toISOString(),
  };
}

router.post("/auth/register", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const phone = String(req.body?.phone ?? "").trim();
  const password = String(req.body?.password ?? "");
  const submittedReferralCode = String(req.body?.referralCode ?? "").trim().toUpperCase();
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and a password of at least 6 characters are required" });
  }
  try {
    const existing = await pool.query("SELECT id FROM pconnect_users WHERE lower(email)=lower($1) LIMIT 1", [email]);
    if (existing.rows[0]) return res.status(409).json({ error: "An account with this email already exists" });
    if (submittedReferralCode) {
      const referrer = await pool.query("SELECT id FROM pconnect_users WHERE lower(referral_code)=lower($1)", [submittedReferralCode]);
      if (!referrer.rows[0]) return res.status(400).json({ error: "That referral code is not valid" });
    }
    const code = otpCode();
    await pool.query("DELETE FROM pconnect_email_verification_tokens WHERE lower(email)=lower($1)", [email]);
    await pool.query(`INSERT INTO pconnect_email_verification_tokens
      (email,name,phone,password_hash,code_hash,referral_code,expires_at) VALUES ($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,
      [email, name, phone || null, passwordHash(password), hashValue(code), submittedReferralCode || null]);
    await sendEmail(email, "Your registration verification code", emailLayout("Verify your email", `<p>Enter this code to complete your registration:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes.</p>`));
    return res.status(202).json({ verificationRequired: true, email });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate")) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    return res.status(503).json({ error: databaseErrorMessage(error) });
  }
});

router.post("/auth/register/verify", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code sent to your email" });
  try {
    const pending = (await pool.query(
      "SELECT * FROM pconnect_email_verification_tokens WHERE lower(email)=lower($1) AND expires_at > now() ORDER BY created_at DESC LIMIT 1", [email],
    )).rows[0];
    if (!pending || pending.code_hash !== hashValue(code)) return res.status(400).json({ error: "That verification code is invalid or expired" });
    const token = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const referrer = pending.referral_code
        ? (await client.query("SELECT id FROM pconnect_users WHERE lower(referral_code)=lower($1)", [pending.referral_code])).rows[0]
        : null;
      const result = await client.query(`INSERT INTO pconnect_users
        (token_identifier,name,email,phone,password_hash,role,email_verified,referral_code,referred_by_user_id)
        VALUES ($1,$2,$3,$4,$5,'user',true,$6,$7) RETURNING *`,
        [token, pending.name, pending.email, pending.phone, pending.password_hash, createReferralCode(), referrer?.id ?? null]);
      const bonusSettings = (await client.query(
        "SELECT key, value FROM pconnect_site_settings WHERE key = ANY($1::text[])",
        [["welcome_bonus_active", "welcome_bonus_amount"]],
      )).rows as { key: string; value: string }[];
      const bonusValues = Object.fromEntries(bonusSettings.map((setting) => [setting.key, setting.value]));
      const welcomeBonus = bonusValues.welcome_bonus_active === "true"
        ? Math.max(0, Number(bonusValues.welcome_bonus_amount ?? 0))
        : 0;
      const wallet = (await client.query(
        "INSERT INTO pconnect_wallets (user_id,balance) VALUES ($1,$2) RETURNING *",
        [result.rows[0].id, welcomeBonus],
      )).rows[0];
      if (referrer) {
        await client.query(
          "INSERT INTO pconnect_referrals (referrer_id,referred_user_id) VALUES ($1,$2)",
          [referrer.id, result.rows[0].id],
        );
      }
      if (welcomeBonus > 0) {
        const reference = `pcc-bonus-${randomUUID()}`;
        await client.query(`INSERT INTO pconnect_wallet_transactions
          (user_id,wallet_id,type,amount,previous_balance,new_balance,status,reference,description)
          VALUES ($1,$2,'welcome_bonus',$3,0,$3,'successful',$4,$5)`,
          [result.rows[0].id, wallet.id, welcomeBonus, reference, "Welcome bonus for new account"]);
        await client.query(`INSERT INTO pconnect_notifications (user_id,title,message,type)
          VALUES ($1,$2,$3,'success')`,
          [result.rows[0].id, "Welcome bonus credited!", `Congratulations! ₦${welcomeBonus.toLocaleString("en-NG")} welcome bonus has been added to your wallet. You can use it to purchase a Pconnect internet access voucher.`]);
      }
      await client.query("DELETE FROM pconnect_email_verification_tokens WHERE email=$1", [email]);
      await client.query("COMMIT");
      if (welcomeBonus > 0) {
        try {
          await sendEmail(email, "Your Pconnect welcome bonus", emailLayout("Welcome to Pconnect!", `<p>Congratulations! You just received a welcome bonus of <strong>₦${welcomeBonus.toLocaleString("en-NG")}</strong>.</p><p>Use it to purchase your Pconnect internet access voucher. Enjoy! ♡</p>`));
        } catch (emailError) {
          console.error("Welcome bonus email could not be sent", emailError);
        }
      }
      return res.status(201).json({ token, user: publicUser(result.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof Error && error.message.includes("duplicate")) return res.status(409).json({ error: "An account with this email already exists" });
      throw error;
    } finally { client.release(); }
  } catch (error) {
    return res.status(503).json({ error: databaseErrorMessage(error) });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required" });
  try {
    const user = (await pool.query("SELECT id, name FROM pconnect_users WHERE lower(email)=lower($1) LIMIT 1", [email])).rows[0];
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      await pool.query("UPDATE pconnect_password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL", [user.id]);
      await pool.query(`INSERT INTO pconnect_password_reset_tokens (user_id,token_hash,expires_at)
        VALUES ($1,$2,now()+interval '24 hours')`, [user.id, hashValue(rawToken)]);
      const origin = typeof req.headers.origin === "string" ? req.headers.origin : `${req.protocol}://${req.get("host")}`;
      const link = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await sendEmail(email, "Reset your password", emailLayout("Reset your password", `<p>Hello ${String(user.name ?? "there")},</p><p>Use the link below to choose a new password. It expires in 24 hours and can only be used once.</p><p><a href="${link}">Reset password</a></p>`));
    }
    return res.json({ message: "If an account exists for that email, a password reset link has been sent." });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Unable to send reset email" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  const token = String(req.body?.token ?? "");
  const newPassword = String(req.body?.password ?? "");
  if (!token || newPassword.length < 6) return res.status(400).json({ error: "A valid reset token and password of at least 6 characters are required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reset = (await client.query(`SELECT id,user_id FROM pconnect_password_reset_tokens
      WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`, [hashValue(token)])).rows[0];
    if (!reset) { await client.query("ROLLBACK"); return res.status(400).json({ error: "That reset link is invalid, expired, or already used" }); }
    await client.query("UPDATE pconnect_users SET password_hash=$1 WHERE id=$2", [passwordHash(newPassword), reset.user_id]);
    await client.query("UPDATE pconnect_password_reset_tokens SET used_at=now() WHERE id=$1", [reset.id]);
    await client.query("UPDATE pconnect_users SET token_identifier=$1 WHERE id=$2", [randomUUID(), reset.user_id]);
    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(503).json({ error: databaseErrorMessage(error) });
  } finally { client.release(); }
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

router.post("/admin/plans/delete", async (req, res) => {
  const planId = String(req.body?.planId ?? "").trim();
  if (!planId) return res.status(400).json({ error: "A valid plan is required" });
  try {
    const usage = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM pconnect_vouchers WHERE plan_id=$1) AS vouchers,
        (SELECT COUNT(*)::int FROM pconnect_purchases WHERE plan_id=$1) AS purchases
    `, [planId]);
    const vouchers = Number(usage.rows[0]?.vouchers ?? 0);
    const purchases = Number(usage.rows[0]?.purchases ?? 0);
    if (vouchers > 0 || purchases > 0) {
      return res.status(409).json({
        error: `This plan cannot be deleted because it has ${vouchers.toLocaleString()} voucher${vouchers === 1 ? "" : "s"} and ${purchases.toLocaleString()} purchase${purchases === 1 ? "" : "s"} linked to it. Deactivate it instead.`,
      });
    }
    const result = await pool.query("DELETE FROM pconnect_voucher_plans WHERE id=$1 RETURNING id", [planId]);
    if (!result.rows[0]) return res.status(404).json({ error: "Plan not found" });
    return res.json({ deleted: true, planId });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Plan could not be deleted" });
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

router.post("/wallet/virtual-account", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  const identityType = req.body?.identityType === "nin" ? "nin" : "bvn";
  const identityNumber = String(req.body?.identityNumber ?? "").replace(/\s/g, "");
  if (!user) return res.status(401).json({ error: "Not logged in" });
  if (!/^\d{11}$/.test(identityNumber)) return res.status(400).json({ error: "Enter a valid 11-digit BVN or NIN" });
  const wallet = (await pool.query("SELECT * FROM pconnect_wallets WHERE user_id=$1", [user.id])).rows[0];
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  if (wallet.virtual_account?.accountNumber) return res.json(wallet.virtual_account);
  try {
    const virtualAccount = await createFlutterwaveVirtualAccount(user, identityType, identityNumber);
    await pool.query("UPDATE pconnect_wallets SET virtual_account=$1 WHERE user_id=$2", [JSON.stringify(virtualAccount), user.id]);
    return res.json(virtualAccount);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Could not create virtual account" });
  }
});

router.post("/webhooks/flutterwave", async (req, res) => {
  const expectedHash = String((await pool.query("SELECT value FROM pconnect_site_settings WHERE key='flutterwave_webhook_hash'")).rows[0]?.value ?? "");
  const receivedHash = String(req.headers["verif-hash"] ?? "");
  if (!expectedHash || !receivedHash || receivedHash !== expectedHash) return res.status(401).json({ error: "Invalid webhook signature" });
  const data = req.body?.data ?? {};
  if (String(data.status ?? "").toLowerCase() !== "successful") return res.json({ received: true });
  const accountNumber = String(data.account_number ?? data.accountNumber ?? "");
  const amount = Number(data.amount);
  const providerTransactionId = String(data.id ?? data.flw_ref ?? "");
  if (!accountNumber || !Number.isFinite(amount) || amount <= 0 || !providerTransactionId) return res.status(400).json({ error: "Incomplete payment event" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wallet = (await client.query(
      "SELECT * FROM pconnect_wallets WHERE virtual_account->>'accountNumber'=$1 FOR UPDATE", [accountNumber],
    )).rows[0];
    if (!wallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Virtual account not found" });
    }
    const duplicate = (await client.query(
      "SELECT id FROM pconnect_wallet_transactions WHERE provider_transaction_id=$1", [providerTransactionId],
    )).rows[0];
    if (duplicate) {
      await client.query("COMMIT");
      return res.json({ received: true, duplicate: true });
    }
    const previousBalance = Number(wallet.balance);
    const newBalance = previousBalance + amount;
    const reference = `pcc-flw-${providerTransactionId}`;
    const transaction = (await client.query(`INSERT INTO pconnect_wallet_transactions
      (user_id,wallet_id,type,amount,previous_balance,new_balance,status,reference,provider,provider_transaction_id,payment_channel,description)
      VALUES ($1,$2,'deposit',$3,$4,$5,'successful',$6,'flutterwave',$7,'bank_transfer','Wallet funding via Flutterwave bank transfer') RETURNING id`,
      [wallet.user_id, wallet.id, amount, previousBalance, newBalance, reference, providerTransactionId])).rows[0];
    await client.query("UPDATE pconnect_wallets SET balance=$1 WHERE id=$2", [newBalance, wallet.id]);
    await creditReferralCommission(client, String(wallet.user_id), amount, transaction.id);
    await client.query(`INSERT INTO pconnect_notifications (user_id,title,message,type)
      VALUES ($1,'Wallet funded successfully',$2,'wallet')`,
      [wallet.user_id, `${amount.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })} has been added to your wallet.`]);
    await client.query("COMMIT");
    return res.json({ received: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: error instanceof Error ? error.message : "Webhook processing failed" });
  } finally {
    client.release();
  }
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
  const result = await pool.query(`INSERT INTO pconnect_users (token_identifier,name,email,role,referral_code)
    VALUES ($1,$2,$3,CASE WHEN NOT EXISTS (SELECT 1 FROM pconnect_users) THEN 'admin' ELSE 'user' END,$4)
    ON CONFLICT (token_identifier) DO UPDATE SET name=COALESCE(EXCLUDED.name,pconnect_users.name),
      email=COALESCE(EXCLUDED.email,pconnect_users.email)
    RETURNING *`, [token, req.body?.name ?? "Demo Customer", req.body?.email ?? "demo@pconnect.local", createReferralCode()]);
  await pool.query(`INSERT INTO pconnect_wallets (user_id,balance) VALUES ($1,0) ON CONFLICT (user_id) DO NOTHING`, [result.rows[0].id]);
  res.json(withId(result.rows[0]));
});

router.get("/referrals", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const referrals = await pool.query(`SELECT r.*, u.name AS "referredName", u.email AS "referredEmail"
    FROM pconnect_referrals r JOIN pconnect_users u ON u.id=r.referred_user_id
    WHERE r.referrer_id=$1 ORDER BY r.created_at DESC`, [user.id]);
  return res.json({
    referralCode: user.referral_code,
    referrals: referrals.rows.map(withId),
    creditedTotal: referrals.rows.reduce((total, row) => total + Number(row.commission_amount ?? 0), 0),
  });
});

router.post("/users/profile", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(404).json({ error: "User not found" });
  const result = await pool.query("UPDATE pconnect_users SET name=COALESCE($1,name), phone=COALESCE($2,phone) WHERE id=$3 RETURNING *",
    [req.body?.name, req.body?.phone, user.id]);
  return res.json(publicUser(result.rows[0]));
});

router.post("/users/change-password", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  if (!passwordMatches(currentPassword, user.password_hash as string | null)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  await pool.query("UPDATE pconnect_users SET password_hash=$1 WHERE id=$2", [passwordHash(newPassword), user.id]);
  res.json({ ok: true });
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

router.get("/dashboard/stats", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM pconnect_purchases WHERE user_id=$1 AND status='completed') AS "totalPurchases",
      (SELECT COUNT(*)::int
       FROM pconnect_purchases p
       JOIN pconnect_vouchers v ON v.id=p.voucher_id
       WHERE p.user_id=$1 AND p.status='completed' AND v.status='sold') AS "activeVouchers"
  `, [user.id]);
  return res.json(result.rows[0] ?? { totalPurchases: 0, activeVouchers: 0 });
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
    const fundingTransaction = (await client.query(`INSERT INTO pconnect_wallet_transactions
      (user_id,wallet_id,type,amount,previous_balance,new_balance,status,reference,provider,description)
      VALUES ($1,$2,'manual_funding',$3,$4,$5,'successful',$6,'admin','Manual funding by admin') RETURNING id`,
      [userId, wallet.id, amount, previousBalance, newBalance, reference])).rows[0];
    await client.query("UPDATE pconnect_wallets SET balance=$1 WHERE id=$2", [newBalance, wallet.id]);
    await creditReferralCommission(client, userId, amount, fundingTransaction.id);
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
  const requestedReference = String(req.body?.reference ?? "").trim();
  const reference = requestedReference || `pcc-${randomUUID()}`;
  if (!/^pcc-[A-Za-z0-9_-]+$/.test(reference)) return res.status(400).json({ error: "Invalid payment reference" });
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

router.post("/deposits/verify", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  const reference = String(req.body?.reference ?? "");
  const providerTransactionId = String(req.body?.providerTransactionId ?? "");
  if (!user) return res.status(401).json({ error: "Not logged in" });
  if (!reference || !providerTransactionId) return res.status(400).json({ error: "Payment reference is required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const transaction = (await client.query(
      `SELECT t.*, w.id AS wallet_id, w.balance
       FROM pconnect_wallet_transactions t
       JOIN pconnect_wallets w ON w.id=t.wallet_id
       WHERE t.reference=$1 AND t.user_id=$2 FOR UPDATE`, [reference, user.id],
    )).rows[0];
    if (!transaction) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment reference not found" });
    }
    if (transaction.status === "successful") {
      await client.query("COMMIT");
      return res.json({ status: "successful", amount: transaction.amount });
    }
    const previousBalance = Number(transaction.balance);
    const newBalance = previousBalance + Number(transaction.amount);
    const updated = (await client.query(`UPDATE pconnect_wallet_transactions
      SET status='successful', previous_balance=$1, new_balance=$2,
          provider_transaction_id=$3
      WHERE id=$4 RETURNING id`, [previousBalance, newBalance, providerTransactionId, transaction.id])).rows[0];
    await client.query("UPDATE pconnect_wallets SET balance=$1 WHERE id=$2", [newBalance, transaction.wallet_id]);
    await creditReferralCommission(client, String(user.id), Number(transaction.amount), updated.id);
    await client.query(`INSERT INTO pconnect_notifications (user_id,title,message,type)
      VALUES ($1,'Wallet funded successfully',$2,'wallet')`,
      [user.id, `${Number(transaction.amount).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })} has been added to your wallet.`]);
    await client.query("COMMIT");
    return res.json({ status: "successful", amount: Number(transaction.amount) });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Payment verification failed" });
  } finally {
    client.release();
  }
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

router.get("/admin/analytics", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    return res.json(await getAnalytics({ from, to }));
  } catch {
    return res.status(400).json({ error: "Analytics could not be loaded for that date range" });
  }
});

router.get("/admin/referrals", async (_req, res) => {
  const settings = (await pool.query(
    "SELECT key,value FROM pconnect_site_settings WHERE key = ANY($1::text[])",
    [["referral_active", "referral_commission_type", "referral_commission_value"]],
  )).rows;
  const referrals = await pool.query(`SELECT r.*, ru.name AS "referrerName", ru.email AS "referrerEmail",
    u.name AS "referredName", u.email AS "referredEmail"
    FROM pconnect_referrals r
    JOIN pconnect_users ru ON ru.id=r.referrer_id
    JOIN pconnect_users u ON u.id=r.referred_user_id
    ORDER BY r.created_at DESC LIMIT 300`);
  return res.json({
    settings: Object.fromEntries(settings.map((row) => [row.key, row.value])),
    referrals: referrals.rows.map(withId),
  });
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
  const hidden = new Set(["smtp_password", "flutterwave_secret_key", "flutterwave_webhook_hash"]);
  if (typeof req.query.key === "string") {
    if (hidden.has(req.query.key)) return res.json(null);
    return res.json(result.rows.find((row) => row.key === req.query.key)?.value ?? null);
  }
  return res.json(Object.fromEntries(result.rows.filter((row) => !hidden.has(row.key)).map((row) => [row.key, row.value])));
});

router.get("/settings/public-key", async (_req, res) => {
  const result = await pool.query("SELECT value FROM pconnect_site_settings WHERE key='flutterwave_public_key'");
  res.json(result.rows[0]?.value ?? null);
});

router.get("/settings/masked", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  const key = String(req.query.key ?? "");
  const result = await pool.query("SELECT value FROM pconnect_site_settings WHERE key=$1", [key]);
  const value = result.rows[0]?.value as string | undefined;
  return res.json(value ? `${value.slice(0, 4)}${"*".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}` : null);
});

router.post("/settings", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  const settings = Array.isArray(req.body?.settings) ? req.body.settings : [];
  for (const setting of settings) {
    await pool.query(`INSERT INTO pconnect_site_settings (key,value) VALUES ($1,$2)
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [setting.key, String(setting.value ?? "")]);
  }
  return res.json(null);
});

router.post("/settings/secret", async (req, res) => {
  const user = await currentUser(tokenFor(req));
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  if (!req.body?.key || !req.body?.value) return res.status(400).json({ error: "Key and value are required" });
  await pool.query(`INSERT INTO pconnect_site_settings (key,value) VALUES ($1,$2)
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [req.body.key, req.body.value]);
  return res.json(null);
});

export default router;