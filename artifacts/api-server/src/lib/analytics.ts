import { pool } from "@workspace/db";

export type AnalyticsRange = { from?: string; to?: string };

function isoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export async function getAnalytics(range: AnalyticsRange = {}) {
  const from = isoDate(range.from);
  const to = isoDate(range.to);
  const filters = from && to ? "WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')" : "";
  const values = from && to ? [from, to] : [];
  const txFilters = from && to ? "AND created_at >= $1::date AND created_at < ($2::date + interval '1 day')" : "";

  const [summary, daily, recent] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM pconnect_purchases WHERE status='completed' ${from && to ? "AND created_at >= $1::date AND created_at < ($2::date + interval '1 day')" : ""}) AS "totalPurchases",
        (SELECT COUNT(*)::int FROM pconnect_users ${filters}) AS "totalUsers",
        (SELECT COALESCE(SUM(amount),0) FROM pconnect_purchases WHERE status='completed' ${from && to ? "AND created_at >= $1::date AND created_at < ($2::date + interval '1 day')" : ""}) AS "purchaseRevenue",
        (SELECT COALESCE(SUM(amount),0) FROM pconnect_wallet_transactions WHERE type='welcome_bonus' AND status='successful' ${txFilters}) AS "welcomeBonus",
        (SELECT COALESCE(SUM(amount),0) FROM pconnect_wallet_transactions WHERE type='referral_commission' AND status='successful' ${txFilters}) AS "referralCommissions",
        (SELECT COALESCE(SUM(balance),0) FROM pconnect_wallets) AS "unusedFunds"
    `, values),
    pool.query(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS purchases, COALESCE(SUM(amount),0) AS revenue
      FROM pconnect_purchases
      WHERE status='completed' ${from && to ? "AND created_at >= $1::date AND created_at < ($2::date + interval '1 day')" : ""}
      GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)
    `, values),
    pool.query(`
      SELECT p.id, p.created_at AS date, p.amount, p.reference, u.name AS "userName",
        u.email AS "userEmail", vp.name AS "planName"
      FROM pconnect_purchases p
      JOIN pconnect_users u ON u.id=p.user_id
      JOIN pconnect_voucher_plans vp ON vp.id=p.plan_id
      WHERE p.status='completed' ${from && to ? "AND p.created_at >= $1::date AND p.created_at < ($2::date + interval '1 day')" : ""}
      ORDER BY p.created_at DESC LIMIT 500
    `, values),
  ]);

  const row = summary.rows[0] ?? {};
  const purchaseRevenue = Number(row.purchaseRevenue ?? 0);
  const welcomeBonus = Number(row.welcomeBonus ?? 0);
  const referralCommissions = Number(row.referralCommissions ?? 0);
  return {
    range: { from: from ?? null, to: to ?? null },
    summary: {
      totalPurchases: Number(row.totalPurchases ?? 0),
      totalUsers: Number(row.totalUsers ?? 0),
      purchaseRevenue,
      welcomeBonus,
      referralCommissions,
      netAfterBonus: purchaseRevenue - welcomeBonus,
      netAfterCommissions: purchaseRevenue - referralCommissions,
      netGenerated: purchaseRevenue - welcomeBonus - referralCommissions,
      unusedFunds: Number(row.unusedFunds ?? 0),
      averagePurchase: Number(row.totalPurchases ?? 0) ? purchaseRevenue / Number(row.totalPurchases) : 0,
    },
    daily: daily.rows.map((item: { date: string; purchases: number; revenue: number }) => ({
      date: item.date,
      purchases: Number(item.purchases ?? 0),
      revenue: Number(item.revenue ?? 0),
    })),
    recentPurchases: recent.rows,
  };
}