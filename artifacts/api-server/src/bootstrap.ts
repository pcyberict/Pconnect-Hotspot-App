import { pool } from "@workspace/db";
import { seed } from "./seed";

const schemaStatements = [
  `DO $$ BEGIN
    CREATE TYPE pconnect_user_role AS ENUM ('user', 'admin');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    CREATE TYPE pconnect_wallet_tx_type AS ENUM ('deposit', 'purchase');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `ALTER TYPE pconnect_wallet_tx_type ADD VALUE IF NOT EXISTS 'manual_funding'`,
  `DO $$ BEGIN
    CREATE TYPE pconnect_wallet_tx_status AS ENUM ('pending', 'successful', 'failed');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    CREATE TYPE pconnect_voucher_status AS ENUM ('available', 'reserved', 'sold', 'disabled');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    CREATE TYPE pconnect_purchase_status AS ENUM ('completed', 'refunded');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `CREATE TABLE IF NOT EXISTS pconnect_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_identifier text NOT NULL,
    name text,
    email text,
    phone text,
    password_hash text,
    role pconnect_user_role NOT NULL DEFAULT 'user',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pconnect_wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pconnect_users(id) ON DELETE CASCADE,
    balance double precision NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS pconnect_voucher_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    duration_label text NOT NULL,
    duration_hours integer NOT NULL,
    price double precision NOT NULL,
    data_limit text,
    description text,
    features jsonb,
    popular boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pconnect_vouchers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES pconnect_voucher_plans(id),
    username text NOT NULL,
    password text NOT NULL,
    status pconnect_voucher_status NOT NULL DEFAULT 'available',
    import_batch_id text,
    notes text,
    sold_to_user_id uuid REFERENCES pconnect_users(id),
    sold_at timestamptz,
    purchase_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pconnect_wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pconnect_users(id),
    wallet_id uuid NOT NULL REFERENCES pconnect_wallets(id),
    type pconnect_wallet_tx_type NOT NULL,
    amount double precision NOT NULL,
    previous_balance double precision NOT NULL,
    new_balance double precision NOT NULL,
    status pconnect_wallet_tx_status NOT NULL,
    reference text NOT NULL,
    provider text,
    provider_transaction_id text,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    payment_channel text,
    virtual_account jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS pconnect_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pconnect_users(id),
    voucher_id uuid NOT NULL REFERENCES pconnect_vouchers(id),
    plan_id uuid NOT NULL REFERENCES pconnect_voucher_plans(id),
    wallet_transaction_id uuid NOT NULL REFERENCES pconnect_wallet_transactions(id),
    amount double precision NOT NULL,
    reference text NOT NULL,
    status pconnect_purchase_status NOT NULL DEFAULT 'completed',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pconnect_site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL,
    value text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pconnect_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pconnect_users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'info',
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pconnect_users_token_idx ON pconnect_users(token_identifier)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pconnect_users_email_idx ON pconnect_users(email)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pconnect_wallets_user_idx ON pconnect_wallets(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pconnect_vouchers_username_idx ON pconnect_vouchers(username)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pconnect_wallet_transactions_reference_idx ON pconnect_wallet_transactions(reference)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pconnect_site_settings_key_idx ON pconnect_site_settings(key)`,
  `CREATE INDEX IF NOT EXISTS pconnect_notifications_user_created_idx ON pconnect_notifications(user_id, created_at DESC)`,
];

export async function bootstrapDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of schemaStatements) {
      await client.query(statement);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await seed();
}