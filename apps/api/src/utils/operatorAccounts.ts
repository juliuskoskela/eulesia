export const SOPS_ADMIN_ACCOUNT_MANAGER = "sops_admin";
export const MANAGED_OPERATOR_PUBLIC_NAME = "Eulesia Operator";

type OperatorAccountLike =
  | {
      managedBy?: string | null;
    }
  | null
  | undefined;

type PublicUserSummaryLike = OperatorAccountLike & {
  id?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  role?: "citizen" | "institution" | "admin" | null;
  institutionType?: string | null;
  institutionName?: string | null;
  identityVerified?: boolean | null;
};

type SanitizedPublicUserSummary<T extends PublicUserSummaryLike> = Omit<
  T,
  "managedBy" | "id"
> & {
  id: string | null;
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
): SanitizedPublicUserSummary<T>;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null,
): SanitizedPublicUserSummary<T> | null;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | undefined,
): SanitizedPublicUserSummary<T> | undefined;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null | undefined,
): SanitizedPublicUserSummary<T> | null | undefined;
export function sanitizePublicUserSummary(account: null): null;
export function sanitizePublicUserSummary(account: undefined): undefined;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null | undefined,
): SanitizedPublicUserSummary<T> | null | undefined {
  if (account === null || account === undefined) {
    return account;
  }

  const { managedBy: _managedBy, ...publicUser } = account;

  if (!isSopsManagedOperatorAccount(account)) {
    return {
      ...publicUser,
      id: publicUser.id ?? null,
    } as SanitizedPublicUserSummary<T>;
  }

  return {
    ...publicUser,
    id: null,
    name: MANAGED_OPERATOR_PUBLIC_NAME,
    avatarUrl: null,
    role: "citizen",
    institutionType: null,
    institutionName: null,
    identityVerified: false,
  } as SanitizedPublicUserSummary<T>;
}
