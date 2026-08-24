import { randomUUID, scryptSync } from "node:crypto";
import { pool } from "@workspace/db";

const demoPassword = "demo1234";

function passwordHash(password: string) {
  const salt = "pconnect-demo-salt";
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const plans = [
  {
    name: "1 Hour",
    durationLabel: "1 Hour Access",
    durationHours: 1,
    price: 200,
    description: "A quick pass for short browsing sessions.",
    features: JSON.stringify([{ icon: "zap", text: "High Speed Internet" }, { icon: "wifi", text: "Full Hotspot Access" }]),
    popular: false,
    sortOrder: 1,
  },
  {
    name: "3 Hours",
    durationLabel: "3 Hours Access",
    durationHours: 3,
    price: 500,
    description: "Great for focused work and streaming.",
    features: JSON.stringify([{ icon: "zap", text: "High Speed Internet" }, { icon: "wifi", text: "Full Hotspot Access" }]),
    popular: false,
    sortOrder: 2,
  },
  {
    name: "12 Hours",
    durationLabel: "12 Hours Access",
    durationHours: 12,
    price: 800,
    description: "Reliable access throughout the day.",
    features: JSON.stringify([{ icon: "zap", text: "High Speed Internet" }, { icon: "shield", text: "Secure Connection" }]),
    popular: false,
    sortOrder: 3,
  },
  {
    name: "1 Day",
    durationLabel: "24 Hours Access",
    durationHours: 24,
    price: 1500,
    description: "Our most popular full-day pass.",
    features: JSON.stringify([{ icon: "zap", text: "High Speed Internet" }, { icon: "wifi", text: "Full Hotspot Access" }, { icon: "star", text: "Best Value" }]),
    popular: true,
    sortOrder: 4,
  },
];

async function findOrCreateUser(email: string, name: string, role: "admin" | "user", token: string) {
  const existing = (await pool.query("SELECT * FROM pconnect_users WHERE lower(email)=lower($1) LIMIT 1", [email])).rows[0];
  if (existing) {
    // Never rewrite an existing account during deploy. This preserves changes
    // made by the owner, including role, name, token, and password.
    await pool.query("INSERT INTO pconnect_wallets (user_id,balance) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING", [existing.id, role === "admin" ? 2500 : 1000]);
    return existing;
  }
  const created = (await pool.query(
    `INSERT INTO pconnect_users (token_identifier,name,email,password_hash,role)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [token, name, email, passwordHash(demoPassword), role],
  )).rows[0];
  await pool.query("INSERT INTO pconnect_wallets (user_id,balance) VALUES ($1,$2)", [created.id, role === "admin" ? 2500 : 1000]);
  return created;
}

export async function seed() {
  const lockKey = 739184;
  await pool.query("SELECT pg_advisory_lock($1)", [lockKey]);
  try {
    const state = (await pool.query(
      `SELECT
         EXISTS (
           SELECT 1
           FROM pconnect_seed_state
           WHERE key = 'demo-data'
         ) AS "seedRecorded",
         EXISTS (
           SELECT 1 FROM pconnect_users
           UNION ALL
           SELECT 1 FROM pconnect_voucher_plans
           UNION ALL
           SELECT 1 FROM pconnect_vouchers
           UNION ALL
           SELECT 1 FROM pconnect_wallets
           UNION ALL
           SELECT 1 FROM pconnect_wallet_transactions
           UNION ALL
           SELECT 1 FROM pconnect_referrals
           UNION ALL
           SELECT 1 FROM pconnect_purchases
           UNION ALL
           SELECT 1 FROM pconnect_site_settings
           UNION ALL
           SELECT 1 FROM pconnect_email_verification_tokens
           UNION ALL
           SELECT 1 FROM pconnect_password_reset_tokens
           UNION ALL
           SELECT 1 FROM pconnect_notifications
         ) AS "hasData"`,
    )).rows[0] as { seedRecorded: boolean; hasData: boolean };

    if (state.seedRecorded || state.hasData) {
      await pool.query(
        "INSERT INTO pconnect_seed_state (key) VALUES ('demo-data') ON CONFLICT (key) DO NOTHING",
      );
      console.log(
        state.seedRecorded
          ? "Demo data seed already completed; skipping."
          : "Database is not empty; recording seed as initialized and skipping demo data.",
      );
      return;
    }

    const admin = await findOrCreateUser("admin@pconnect.local", "Pconnect Admin", "admin", "demo-user");
    await findOrCreateUser("demo@pconnect.local", "Demo Customer", "user", "demo-customer");

    const planIds: string[] = [];
    for (const plan of plans) {
      const existing = (await pool.query("SELECT id FROM pconnect_voucher_plans WHERE name=$1 LIMIT 1", [plan.name])).rows[0];
      const row = existing ?? (await pool.query(
          `INSERT INTO pconnect_voucher_plans (name,duration_label,duration_hours,price,description,features,popular,active,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8) RETURNING id`,
          [plan.name, plan.durationLabel, plan.durationHours, plan.price, plan.description, plan.features, plan.popular, plan.sortOrder],
        )).rows[0];
      planIds.push(row.id);
    }

    for (let planIndex = 0; planIndex < planIds.length; planIndex += 1) {
      for (let voucherIndex = 1; voucherIndex <= 3; voucherIndex += 1) {
        const username = `demo-${planIndex + 1}-${voucherIndex}`;
        await pool.query(
          `INSERT INTO pconnect_vouchers (plan_id,username,password,status,import_batch_id,notes)
           VALUES ($1,$2,$3,'available','demo-seed','Seeded demo voucher')
           ON CONFLICT (username) DO NOTHING`,
          [planIds[planIndex], username, `pass-${planIndex + 1}-${voucherIndex}`],
        );
      }
    }

    const settings = [
      ["site_name", "PCYBER CONNECT"],
      ["site_tagline", "Fast, reliable WiFi vouchers"],
      ["footer_text", "© PCYBER ICT SERVICES. All rights reserved."],
      ["whatsapp_group_url", "https://chat.whatsapp.com/your-group-invite"],
      ["whatsapp_support_number", "2340000000000"],
    ];
    for (const [key, value] of settings) {
      await pool.query(
        `INSERT INTO pconnect_site_settings (key,value) VALUES ($1,$2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value],
      );
    }

    await pool.query(
      "INSERT INTO pconnect_seed_state (key) VALUES ('demo-data') ON CONFLICT (key) DO NOTHING",
    );
    console.log(`Ensured ${plans.length} default plans, ${plans.length * 3} demo vouchers, and demo users without overwriting existing data.`);
  } finally {
    await pool.query("SELECT pg_advisory_unlock($1)", [lockKey]);
  }
}
