import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../utils/env.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    if (env.EMAIL_PROVIDER === "smtp" && env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE, // true for 465, false for other ports
        auth: env.SMTP_USER
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
      });
    }
  }

  async send(options: EmailOptions): Promise<boolean> {
    if (env.EMAIL_PROVIDER === "console" || !this.transporter) {
      // Development: log to console
      console.log("\n📧 Email (console mode):");
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Content:\n${options.text || options.html}\n`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async sendMagicLink(email: string, token: string): Promise<boolean> {
    const loginUrl = `${env.API_URL}/api/v1/auth/verify/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sign in to Eulesia</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: #1e40af; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">E</div>
            <h1 style="margin: 16px 0 0; font-size: 24px; color: #111827;">Eulesia</h1>
          </div>

          <h2 style="font-size: 20px; margin-bottom: 16px;">Sign in to your account</h2>

          <p>Click the button below to sign in to Eulesia. This link will expire in 15 minutes.</p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500;">
              Sign in to Eulesia
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this URL into your browser:<br>
            <a href="${loginUrl}" style="color: #1e40af; word-break: break-all;">${loginUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

          <p style="color: #9ca3af; font-size: 12px;">
            If you didn't request this email, you can safely ignore it.<br>
            Eulesia — European Civic Digital Infrastructure
          </p>
        </body>
      </html>
    `;

    const text = `
Sign in to Eulesia

Click this link to sign in (expires in 15 minutes):
${loginUrl}

If you didn't request this email, you can safely ignore it.

Eulesia — European Civic Digital Infrastructure
    `.trim();

    return this.send({
      to: email,
      subject: "Sign in to Eulesia",
      html,
      text,
    });
  }

  async sendWaitlistApproval(
    email: string,
    inviteCode: string,
    locale: string = "en",
  ): Promise<boolean> {
    const appUrl = env.APP_URL || "https://eulesia.org";
    const isFinnish = locale === "fi";

    const subject = isFinnish
      ? "Tervetuloa Eulesiaan – kutsukoodisi"
      : "Welcome to Eulesia – Your Invite Code";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: #1e40af; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">E</div>
            <h1 style="margin: 16px 0 0; font-size: 24px; color: #111827;">Eulesia</h1>
          </div>

          <h2 style="font-size: 20px; margin-bottom: 16px;">
            ${isFinnish ? "Paikkasi on valmis!" : "Your spot is ready!"}
          </h2>

          <p>${
            isFinnish
              ? "Olet saanut kutsun Eulesiaan. Käytä alla olevaa kutsukoodia rekisteröityäksesi."
              : "You have been approved to join Eulesia. Use the invite code below to register."
          }</p>

          <div style="text-align: center; margin: 32px 0; padding: 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
              ${isFinnish ? "Kutsukoodisi" : "Your invite code"}
            </p>
            <p style="margin: 0; font-family: monospace; font-size: 28px; font-weight: bold; color: #166534; letter-spacing: 2px;">
              ${inviteCode}
            </p>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${appUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500;">
              ${isFinnish ? "Siirry Eulesiaan" : "Go to Eulesia"}
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            ${
              isFinnish
                ? "Tämä kutsukoodi on voimassa 30 päivää."
                : "This invite code is valid for 30 days."
            }
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
          <p style="color: #9ca3af; font-size: 12px;">
            Eulesia — European Civic Digital Infrastructure
          </p>
        </body>
      </html>
    `;

    const text = isFinnish
      ? `Tervetuloa Eulesiaan!\n\nKutsukoodisi: ${inviteCode}\n\nSiirry: ${appUrl}\n\nKoodi on voimassa 30 päivää.`
      : `Welcome to Eulesia!\n\nYour invite code: ${inviteCode}\n\nGo to: ${appUrl}\n\nThis code is valid for 30 days.`;

    return this.send({ to: email, subject, html, text });
  }
}

export const emailService = new EmailService();
