import nodemailer from "nodemailer";
import { pool } from "@workspace/db";

async function smtpSettings() {
  const result = await pool.query(
    "SELECT key, value FROM pconnect_site_settings WHERE key = ANY($1::text[])",
    [["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email", "smtp_from_name"]],
  );
  const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  if (!values.smtp_host || !values.smtp_port || !values.smtp_username || !values.smtp_password || !values.smtp_from_email) {
    throw new Error("SMTP is not configured. Ask an administrator to complete SMTP settings.");
  }
  return values;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const settings = await smtpSettings();
  const transport = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port),
    secure: Number(settings.smtp_port) === 465,
    auth: { user: settings.smtp_username, pass: settings.smtp_password },
  });
  await transport.sendMail({
    from: settings.smtp_from_name ? `"${settings.smtp_from_name}" <${settings.smtp_from_email}>` : settings.smtp_from_email,
    to,
    subject,
    html,
  });
}

export const emailLayout = (title: string, body: string) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24113f">
    <h2>${title}</h2><div>${body}</div>
    <p style="color:#777;font-size:12px;margin-top:32px">If you did not request this email, you can safely ignore it.</p>
  </div>`;