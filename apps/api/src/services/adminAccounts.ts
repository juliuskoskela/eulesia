import { z } from "zod";

export const bootstrapAdminAccountSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform((value) => value.toLowerCase()),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase())
    .optional()
    .nullable(),
  name: z.string().min(2).max(255),
  passwordHash: z.string().min(1),
  reseedPassword: z.boolean().optional().default(false),
});

export type BootstrapAdminAccount = z.infer<typeof bootstrapAdminAccountSchema>;

interface ResolveBootstrapAdminPasswordInput {
  existingPasswordHash?: string | null;
  seedPasswordHash: string;
  reseedPassword?: boolean;
}

interface BootstrapAdminPasswordDecision {
  passwordHash: string;
  revokeSessions: boolean;
}

export function resolveBootstrapAdminPassword({
  existingPasswordHash,
  seedPasswordHash,
  reseedPassword = false,
}: ResolveBootstrapAdminPasswordInput): BootstrapAdminPasswordDecision {
  if (!existingPasswordHash) {
    return {
      passwordHash: seedPasswordHash,
      revokeSessions: true,
    };
  }

  if (reseedPassword) {
    return {
      passwordHash: seedPasswordHash,
      revokeSessions: existingPasswordHash !== seedPasswordHash,
    };
  }

  return {
    passwordHash: existingPasswordHash,
    revokeSessions: false,
  };
}

export function parseBootstrapAdminAccounts(
  raw: string,
): BootstrapAdminAccount[] {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error(
      "BOOTSTRAP_ADMIN_ACCOUNTS_FILE must contain valid JSON data",
    );
  }

  const accounts = z.array(bootstrapAdminAccountSchema).parse(parsedJson);
  const usernames = new Set<string>();
  const emails = new Set<string>();

  for (const account of accounts) {
    if (usernames.has(account.username)) {
      throw new Error(
        `Duplicate bootstrap admin username: ${account.username}`,
      );
    }
    usernames.add(account.username);

    if (account.email) {
      if (emails.has(account.email)) {
        throw new Error(`Duplicate bootstrap admin email: ${account.email}`);
      }
      emails.add(account.email);
    }
  }

  return accounts;
}
