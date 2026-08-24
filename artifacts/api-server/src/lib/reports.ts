import { pool } from "@workspace/db";
import { emailLayout, sendEmail } from "./mailer";
import { getAnalytics } from "./analytics";

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function previousWeek() {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const day = end.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  end.setUTCDate(end.getUTCDate() - daysSinceMonday - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { from: dateOnly(start), to: dateOnly(end) };
}

function previousMonth() {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(0);
  const start = new Date(end);
  start.setUTCDate(1);
  return { from: dateOnly(start), to: dateOnly(end) };
}

function money(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function reportHtml(period: string, analytics: Awaited<ReturnType<typeof getAnalytics>>) {
  const s = analytics.summary;
  const rows = [
    ["Total purchases", s.totalPurchases.toLocaleString()],
    ["New users", s.totalUsers.toLocaleString()],
    ["Purchase revenue", money(s.purchaseRevenue)],
    ["Welcome bonuses distributed", money(s.welcomeBonus)],
    ["Revenue after welcome bonus", money(s.netAfterBonus)],
    ["Referral commissions", money(s.referralCommissions)],
    ["Revenue after commissions", money(s.netGenerated)],
    ["Users' unused wallet funds", money(s.unusedFunds)],
  ];
  return emailLayout(`${period} analytics report`, `
    <p>Here is the ${period.toLowerCase()} performance summary for ${analytics.range.from} to ${analytics.range.to}.</p>
    <table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${label}</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${value}</td></tr>`).join("")}</table>
    <p style="margin-top:20px">Net generated is purchase revenue minus welcome bonuses and referral commissions.</p>
  `);
}

async function sendScheduledReport(kind: "weekly" | "monthly", period: { from: string; to: string }) {
  const key = `analytics_last_${kind}_report`;
  const last = await pool.query("SELECT value FROM pconnect_site_settings WHERE key=$1", [key]);
  const marker = period.to;
  if (last.rows[0]?.value === marker) return;
  const admins = await pool.query("SELECT email FROM pconnect_users WHERE role='admin' AND email IS NOT NULL AND email <> ''");
  if (!admins.rows.length) return;
  const analytics = await getAnalytics(period);
  const subject = `Pconnect ${kind === "weekly" ? "weekly" : "monthly"} analytics report · ${period.from} – ${period.to}`;
  const results = await Promise.allSettled(admins.rows.map((admin: { email: string }) => sendEmail(admin.email, subject, reportHtml(kind === "weekly" ? "Weekly" : "Monthly", analytics))));
  if (results.some((result: PromiseSettledResult<void>) => result.status === "rejected")) {
    console.error(`Some ${kind} analytics reports could not be sent`, results.filter((result: PromiseSettledResult<void>) => result.status === "rejected"));
    return;
  }
  await pool.query(`INSERT INTO pconnect_site_settings (key,value) VALUES ($1,$2)
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [key, marker]);
}

export async function sendDueAnalyticsReports() {
  const now = new Date();
  if (now.getUTCDay() === 1 && now.getUTCHours() === 8) await sendScheduledReport("weekly", previousWeek());
  if (now.getUTCDate() === 1 && now.getUTCHours() === 8) await sendScheduledReport("monthly", previousMonth());
}