export const SOPS_ADMIN_ACCOUNT_MANAGER = "sops_admin";
export const MANAGED_OPERATOR_PUBLIC_NAME = "Eulesia Operator";

type OperatorAccountLike =
  | {
      managedBy?: string | null;
    }
  | null
  | undefined;

type PublicUserSummaryLike = OperatorAccountLike & {
  name?: string | null;
  avatarUrl?: string | null;
  role?: "citizen" | "institution" | "admin" | null;
  institutionType?: string | null;
  institutionName?: string | null;
  identityVerified?: boolean | null;
};

export function isSopsManagedOperatorAccount(
  account: OperatorAccountLike,
): boolean {
  return account?.managedBy === SOPS_ADMIN_ACCOUNT_MANAGER;
}

export function isPubliclyDiscoverableAccount(
  account: OperatorAccountLike,
): boolean {
  return !isSopsManagedOperatorAccount(account);
}

export function getPublicAccountName(
  account: Pick<PublicUserSummaryLike, "managedBy" | "name"> | null | undefined,
  fallback = "Unknown",
): string {
  if (!account) {
    return fallback;
  }

  if (isSopsManagedOperatorAccount(account)) {
    return MANAGED_OPERATOR_PUBLIC_NAME;
  }

  return account.name || fallback;
}

export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T,
): Omit<T, "managedBy">;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null,
): Omit<T, "managedBy"> | null;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | undefined,
): Omit<T, "managedBy"> | undefined;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null | undefined,
): Omit<T, "managedBy"> | null | undefined;
export function sanitizePublicUserSummary(account: null): null;
export function sanitizePublicUserSummary(account: undefined): undefined;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null | undefined,
): Omit<T, "managedBy"> | null | undefined {
  if (account === null || account === undefined) {
    return account;
  }

  const { managedBy: _managedBy, ...publicUser } = account;

  if (!isSopsManagedOperatorAccount(account)) {
    return publicUser;
  }

  return {
    ...publicUser,
    name: MANAGED_OPERATOR_PUBLIC_NAME,
    avatarUrl: null,
    role: "citizen",
    institutionType: null,
    institutionName: null,
    identityVerified: false,
  } as Omit<T, "managedBy">;
}
