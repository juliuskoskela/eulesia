import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3001"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/eulesia"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("development-secret-key-change-in-production-32chars"),
  COOKIE_DOMAIN: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:3001"),

  // Email - SMTP is recommended for EU sovereignty
  EMAIL_PROVIDER: z.enum(["smtp", "console"]).default("console"),
  EMAIL_FROM: z.string().email().default("auth@eulesia.local"),

  // SMTP Configuration (for EMAIL_PROVIDER=smtp)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).default("587"),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Capacitor native app origins (comma-separated)
  ALLOWED_ORIGINS: z.string().optional(),

  // Web Push (VAPID keys — generate with: npx web-push generate-vapid-keys)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@eulesia.eu"),

  // Firebase Cloud Messaging (native push)
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),

  // eIDAS (future)
  EIDAS_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

export const env = envSchema.parse(process.env);
