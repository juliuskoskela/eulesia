import { describe, expect, it } from "vitest";
import {
  parseBootstrapAdminAccounts,
  resolveBootstrapAdminPassword,
  selectExistingBootstrapAdmin,
} from "./adminAccounts.js";

describe("parseBootstrapAdminAccounts", () => {
  it("normalizes usernames and emails", () => {
    const accounts = parseBootstrapAdminAccounts(
      JSON.stringify([
        {
          managedKey: "Ops_Julius",
          username: "Ops_Julius",
          email: "Ops+Julius@Eulesia.org",
          name: "Julius Ops",
          passwordHash: "$argon2id$test",
        },
      ]),
    );

    expect(accounts).toEqual([
      {
        managedKey: "ops_julius",
        username: "ops_julius",
        email: "ops+julius@eulesia.org",
        name: "Julius Ops",
        passwordHash: "$argon2id$test",
        reseedPassword: false,
      },
    ]);
  });

  it("rejects duplicate usernames", () => {
    expect(() =>
      parseBootstrapAdminAccounts(
        JSON.stringify([
          {
            managedKey: "ops_one",
            username: "ops_admin",
            name: "One",
            passwordHash: "$argon2id$one",
          },
          {
            managedKey: "ops_two",
            username: "OPS_ADMIN",
            name: "Two",
            passwordHash: "$argon2id$two",
          },
        ]),
      ),
    ).toThrow("Duplicate bootstrap admin username");
  });

  it("rejects duplicate emails", () => {
    expect(() =>
      parseBootstrapAdminAccounts(
        JSON.stringify([
          {
            managedKey: "ops_one",
            username: "ops_one",
            email: "ops@example.org",
            name: "One",
            passwordHash: "$argon2id$one",
          },
          {
            managedKey: "ops_two",
            username: "ops_two",
            email: "OPS@example.org",
            name: "Two",
            passwordHash: "$argon2id$two",
          },
        ]),
      ),
    ).toThrow("Duplicate bootstrap admin email");
  });

  it("rejects duplicate managed keys", () => {
    expect(() =>
      parseBootstrapAdminAccounts(
        JSON.stringify([
          {
            managedKey: "ops_julius",
            username: "ops_one",
            name: "One",
            passwordHash: "$argon2id$one",
          },
          {
            managedKey: "OPS_JULIUS",
            username: "ops_two",
            name: "Two",
            passwordHash: "$argon2id$two",
          },
        ]),
      ),
    ).toThrow("Duplicate bootstrap admin managed key");
  });
});

describe("resolveBootstrapAdminPassword", () => {
  it("preserves an existing password hash by default", () => {
    expect(
      resolveBootstrapAdminPassword({
        existingPasswordHash: "$argon2id$current",
        seedPasswordHash: "$argon2id$seed",
      }),
    ).toEqual({
      passwordHash: "$argon2id$current",
      revokeSessions: false,
    });
  });

  it("seeds a missing password hash", () => {
    expect(
      resolveBootstrapAdminPassword({
        existingPasswordHash: "",
        seedPasswordHash: "$argon2id$seed",
      }),
    ).toEqual({
      passwordHash: "$argon2id$seed",
      revokeSessions: true,
    });
  });

  it("reseeds when explicitly requested", () => {
    expect(
      resolveBootstrapAdminPassword({
        existingPasswordHash: "$argon2id$current",
        seedPasswordHash: "$argon2id$seed",
        reseedPassword: true,
      }),
    ).toEqual({
      passwordHash: "$argon2id$seed",
      revokeSessions: true,
    });
  });
});

describe("selectExistingBootstrapAdmin", () => {
  it("matches a managed account by stable managed key after a rename", () => {
    const existing = selectExistingBootstrapAdmin(
      {
        managedKey: "ops_julius",
        username: "juliuskoskela",
        email: "julius.koskela@digimuoto.com",
        name: "Julius Koskela",
        passwordHash: "$argon2id$seed",
        reseedPassword: false,
      },
      [
        {
          id: "user-1",
          username: "legacy-admin",
          email: "legacy@example.org",
          managedBy: "sops_admin",
          managedKey: "ops_julius",
        },
      ],
    );

    expect(existing?.id).toBe("user-1");
  });

  it("falls back to legacy username or email matching before managed keys are backfilled", () => {
    const existing = selectExistingBootstrapAdmin(
      {
        managedKey: "ops_julius",
        username: "juliuskoskela",
        email: "julius.koskela@digimuoto.com",
        name: "Julius Koskela",
        passwordHash: "$argon2id$seed",
        reseedPassword: false,
      },
      [
        {
          id: "user-1",
          username: "juliuskoskela",
          email: "julius.koskela@digimuoto.com",
          managedBy: "sops_admin",
          managedKey: null,
        },
      ],
    );

    expect(existing?.id).toBe("user-1");
  });

  it("rejects a renamed managed account if the new username belongs to another row", () => {
    expect(() =>
      selectExistingBootstrapAdmin(
        {
          managedKey: "ops_julius",
          username: "juliuskoskela",
          email: "julius.koskela@digimuoto.com",
          name: "Julius Koskela",
          passwordHash: "$argon2id$seed",
          reseedPassword: false,
        },
        [
          {
            id: "managed-user",
            username: "legacy-admin",
            email: "legacy@example.org",
            managedBy: "sops_admin",
            managedKey: "ops_julius",
          },
          {
            id: "other-user",
            username: "juliuskoskela",
            email: "other@example.org",
            managedBy: null,
            managedKey: null,
          },
        ],
      ),
    ).toThrow("conflicts with existing username");
  });
});
