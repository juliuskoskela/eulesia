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
  canViewProfile?: boolean | null;
  role?: "citizen" | "institution" | "admin" | null;
  institutionType?: string | null;
  institutionName?: string | null;
  identityVerified?: boolean | null;
};

type SanitizedPublicUserSummary<T extends PublicUserSummaryLike> = Omit<
  T,
  "managedBy" | "id" | "canViewProfile"
> & {
  id: string | null;
  canViewProfile: boolean;
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

export function canViewPublicUserProfile(
  account: Pick<PublicUserSummaryLike, "id" | "managedBy"> | null | undefined,
): boolean {
  return Boolean(account?.id) && !isSopsManagedOperatorAccount(account);
}

export function getPublicUserId(
  account: Pick<PublicUserSummaryLike, "id" | "managedBy"> | null | undefined,
  options?: SanitizePublicUserSummaryOptions,
): string | null {
  if (!account) {
    return null;
  }

  if (isSopsManagedOperatorAccount(account)) {
    return shouldPreservePublicUserSummaryId(account, options)
      ? (account.id ?? null)
      : null;
  }

  return account.id ?? null;
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
  if (!isSopsManagedOperatorAccount(account)) {
    return {
      ...publicUser,
      id: getPublicUserId(account, options),
      canViewProfile: canViewPublicUserProfile(account),
    } as SanitizedPublicUserSummary<T>;
  }

  return {
    ...publicUser,
    id: getPublicUserId(account, options),
    canViewProfile: false,
    name: MANAGED_OPERATOR_PUBLIC_NAME,
    avatarUrl: null,
    role: "citizen",
    institutionType: null,
    institutionName: null,
    identityVerified: false,
  } as SanitizedPublicUserSummary<T>;
}
