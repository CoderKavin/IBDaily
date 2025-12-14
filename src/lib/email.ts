/**
 * Email provider abstraction - supports Resend and SMTP
 * Gracefully handles missing configuration
 */

export type EmailProvider = "resend" | "smtp" | "none";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Check which email provider is configured
 */
export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    return "resend";
  }

  if (
    provider === "smtp" &&
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return "smtp";
  }

  return "none";
}

/**
 * Check if email is configured
 */
export function isEmailConfigured(): boolean {
  return getEmailProvider() !== "none";
}

/**
 * Get the FROM address
 */
function getFromAddress(): string {
  return process.env.EMAIL_FROM || "IBDaily <noreply@ibdaily.app>";
}

/**
 * Send email via Resend
 */
async function sendViaResend(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend error:", error);
      return { success: false, error: `Resend API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Resend send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send email via SMTP using nodemailer
 * Note: nodemailer is dynamically imported to avoid bundling issues
 */
async function sendViaSMTP(options: EmailOptions): Promise<EmailResult> {
  try {
    // Dynamic import to avoid bundling nodemailer if not used
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: getFromAddress(),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { success: true };
  } catch (error) {
    console.error("SMTP send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send an email using the configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = getEmailProvider();

  switch (provider) {
    case "resend":
      return sendViaResend(options);
    case "smtp":
      return sendViaSMTP(options);
    case "none":
      console.warn("Email not configured, skipping send to:", options.to);
      return { success: false, error: "Email not configured" };
  }
}

/**
 * Generate reminder email HTML
 */
export function generateReminderEmail(params: {
  userName: string;
  cohortName: string;
  minutesLeft: number;
  isLastCall: boolean;
}): { subject: string; html: string; text: string } {
  const { userName, cohortName, minutesLeft, isLastCall } = params;

  const subject = isLastCall
    ? `Last call! ${minutesLeft} minutes to submit - IBDaily`
    : `Reminder: ${minutesLeft} minutes until deadline - IBDaily`;

  const urgencyText = isLastCall
    ? "This is your last call reminder!"
    : "Friendly reminder:";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${isLastCall ? "#FEF2F2" : "#EFF6FF"}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 10px 0; color: ${isLastCall ? "#DC2626" : "#2563EB"};">
      ${urgencyText}
    </h2>
    <p style="margin: 0; font-size: 16px;">
      You have <strong>${minutesLeft} minutes</strong> left to submit today's learning bullets.
    </p>
  </div>

  <p>Hi ${userName || "there"},</p>

  <p>
    Your cohort <strong>${cohortName}</strong> is waiting for your submission!
    Don't break your streak - take 2 minutes to log what you learned today.
  </p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/submit"
       style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
      Submit Now
    </a>
  </div>

  <p style="font-size: 14px; color: #666;">
    Deadline: 9:00 PM IST
  </p>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

  <p style="font-size: 12px; color: #9CA3AF;">
    You're receiving this because you enabled reminders in IBDaily.
    <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings" style="color: #6B7280;">
      Manage preferences
    </a>
  </p>
</body>
</html>
  `.trim();

  const text = `
${urgencyText}

You have ${minutesLeft} minutes left to submit today's learning bullets.

Hi ${userName || "there"},

Your cohort "${cohortName}" is waiting for your submission! Don't break your streak - take 2 minutes to log what you learned today.

Submit now: ${process.env.NEXTAUTH_URL || "http://localhost:3000"}/submit

Deadline: 9:00 PM IST

---
You're receiving this because you enabled reminders in IBDaily.
Manage preferences: ${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings
  `.trim();

  return { subject, html, text };
}
