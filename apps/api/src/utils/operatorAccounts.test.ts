import { describe, expect, it } from "vitest";
import {
  MANAGED_OPERATOR_PUBLIC_NAME,
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
      id: "user-1",
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
      name: "Citizen User",
      avatarUrl: null,
      role: "citizen",
    });
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
