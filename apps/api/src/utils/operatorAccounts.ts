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

type SanitizePublicUserSummaryOptions = {
  preserveId?: boolean;
  preserveIdForUserId?: string | null;
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

function shouldPreservePublicUserSummaryId(
  account: PublicUserSummaryLike,
  options?: SanitizePublicUserSummaryOptions,
): boolean {
  if (!account) {
    return false;
  }

  if (options?.preserveId) {
    return true;
  }

  if (!options?.preserveIdForUserId) {
    return false;
  }

  return account.id === options.preserveIdForUserId;
}

export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T,
  options?: SanitizePublicUserSummaryOptions,
): SanitizedPublicUserSummary<T>;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null,
  options?: SanitizePublicUserSummaryOptions,
): SanitizedPublicUserSummary<T> | null;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | undefined,
  options?: SanitizePublicUserSummaryOptions,
): SanitizedPublicUserSummary<T> | undefined;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null | undefined,
  options?: SanitizePublicUserSummaryOptions,
): SanitizedPublicUserSummary<T> | null | undefined;
export function sanitizePublicUserSummary(
  account: null,
  options?: SanitizePublicUserSummaryOptions,
): null;
export function sanitizePublicUserSummary(
  account: undefined,
  options?: SanitizePublicUserSummaryOptions,
): undefined;
export function sanitizePublicUserSummary<T extends PublicUserSummaryLike>(
  account: T | null | undefined,
  options?: SanitizePublicUserSummaryOptions,
): SanitizedPublicUserSummary<T> | null | undefined {
  if (account === null || account === undefined) {
    return account;
  }

  const { managedBy: _managedBy, ...publicUser } = account;
  const preserveId = shouldPreservePublicUserSummaryId(account, options);

  if (!isSopsManagedOperatorAccount(account)) {
    return {
      ...publicUser,
      id: publicUser.id ?? null,
    } as SanitizedPublicUserSummary<T>;
  }

  return {
    ...publicUser,
    id: preserveId ? (publicUser.id ?? null) : null,
    name: MANAGED_OPERATOR_PUBLIC_NAME,
    avatarUrl: null,
    role: "citizen",
    institutionType: null,
    institutionName: null,
    identityVerified: false,
  } as SanitizedPublicUserSummary<T>;
}
