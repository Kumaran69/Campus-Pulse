const nodemailer = require("nodemailer");

let transporter = null;

/*
 * If SMTP_HOST is configured, sends real email. Otherwise falls back
 * to logging the email to the console — so notifications work (and
 * are visible/testable via `docker compose logs backend`) without
 * requiring a real mail account to be wired up for a demo or pilot.
 */
function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else {
    transporter = {
      sendMail: async (opts) => {
        console.log(`[mailer] (dev mode, no SMTP_HOST configured) would send email:\n  to: ${opts.to}\n  subject: ${opts.subject}\n  body: ${opts.text}`);
        return { messageId: `dev-${Date.now()}` };
      },
    };
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  try {
    const t = getTransporter();
    await t.sendMail({ from: process.env.SMTP_FROM || "Campus Pulse <no-reply@campuspulse.demo>", to, subject, text });
  } catch (err) {
    // Notifications are best-effort — a failed email should never break
    // the request that triggered it (e.g. a risk score computation).
    console.error("[mailer] failed to send:", err.message);
  }
}

module.exports = { sendMail };
