import { describe, expect, it } from "vitest";
import {
  MANAGED_OPERATOR_PUBLIC_NAME,
  canViewPublicUserProfile,
  getPublicAccountName,
  isPubliclyDiscoverableAccount,
  isSopsManagedOperatorAccount,
  sanitizePublicUserSummary,
} from "./operatorAccounts.js";

describe("operator account helpers", () => {
  it("identifies SOPS-managed operator accounts", () => {
    expect(isSopsManagedOperatorAccount({ managedBy: "sops_admin" })).toBe(
      true,
    );
    expect(isSopsManagedOperatorAccount({ managedBy: null })).toBe(false);
    expect(isSopsManagedOperatorAccount(undefined)).toBe(false);
  });

  it("hides SOPS-managed operator accounts from public discovery", () => {
    expect(isPubliclyDiscoverableAccount({ managedBy: "sops_admin" })).toBe(
      false,
    );
    expect(isPubliclyDiscoverableAccount({ managedBy: "manual" })).toBe(true);
  });

  it("scrubs public summaries for SOPS-managed operator accounts", () => {
    expect(
      sanitizePublicUserSummary({
        id: "user-1",
        name: "Secret Admin",
        avatarUrl: "https://example.com/avatar.png",
        role: "admin" as const,
        institutionType: "ministry",
        institutionName: "Secret Ministry",
        identityVerified: true,
        managedBy: "sops_admin",
      }),
    ).toEqual({
      id: null,
      canViewProfile: false,
      name: MANAGED_OPERATOR_PUBLIC_NAME,
      avatarUrl: null,
      role: "citizen",
      institutionType: null,
      institutionName: null,
      identityVerified: false,
    });
  });

  it("preserves the id for managed accounts when explicitly requested", () => {
    expect(
      sanitizePublicUserSummary(
        {
          id: "user-1",
          name: "Secret Admin",
          avatarUrl: "https://example.com/avatar.png",
          role: "admin" as const,
          institutionType: "ministry",
          institutionName: "Secret Ministry",
          identityVerified: true,
          managedBy: "sops_admin",
        },
        { preserveId: true },
      ),
    ).toEqual({
      id: "user-1",
      canViewProfile: false,
      name: MANAGED_OPERATOR_PUBLIC_NAME,
      avatarUrl: null,
      role: "citizen",
      institutionType: null,
      institutionName: null,
      identityVerified: false,
    });
  });

  it("preserves the id for the current managed account without restoring the rest of the summary", () => {
    expect(
      sanitizePublicUserSummary(
        {
          id: "user-1",
          name: "Secret Admin",
          avatarUrl: "https://example.com/avatar.png",
          role: "admin" as const,
          institutionType: "ministry",
          institutionName: "Secret Ministry",
          identityVerified: true,
          managedBy: "sops_admin",
        },
        { preserveIdForUserId: "user-1" },
      ),
    ).toEqual({
      id: "user-1",
      canViewProfile: false,
      name: MANAGED_OPERATOR_PUBLIC_NAME,
      avatarUrl: null,
      role: "citizen",
      institutionType: null,
      institutionName: null,
      identityVerified: false,
    });
  });

  it("keeps normal public summaries unchanged", () => {
    expect(
      sanitizePublicUserSummary({
        id: "user-2",
        name: "Citizen User",
        avatarUrl: null,
        role: "citizen" as const,
        managedBy: null,
      }),
    ).toEqual({
      id: "user-2",
      canViewProfile: true,
      name: "Citizen User",
      avatarUrl: null,
      role: "citizen",
    });
  });

  it("marks managed operator accounts as non-linkable even when their id is preserved", () => {
    expect(
      canViewPublicUserProfile({
        id: "user-1",
        managedBy: "sops_admin",
      }),
    ).toBe(false);

    expect(
      canViewPublicUserProfile({
        id: "user-2",
        managedBy: null,
      }),
    ).toBe(true);
  });

  it("scrubs public display names for SOPS-managed operator accounts", () => {
    expect(
      getPublicAccountName({
        managedBy: "sops_admin",
        name: "Secret Admin",
      }),
    ).toBe(MANAGED_OPERATOR_PUBLIC_NAME);

    expect(
      getPublicAccountName({
        managedBy: null,
        name: "Citizen User",
      }),
    ).toBe("Citizen User");
  });
});
