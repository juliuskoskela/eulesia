import { describe, expect, it } from "vitest";
import {
  parseBootstrapAdminAccounts,
  resolveBootstrapAdminPassword,
} from "./adminAccounts.js";

describe("parseBootstrapAdminAccounts", () => {
  it("normalizes usernames and emails", () => {
    const accounts = parseBootstrapAdminAccounts(
      JSON.stringify([
        {
          username: "Ops_Julius",
          email: "Ops+Julius@Eulesia.org",
          name: "Julius Ops",
          passwordHash: "$argon2id$test",
        },
      ]),
    );

    expect(accounts).toEqual([
      {
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
            username: "ops_admin",
            name: "One",
            passwordHash: "$argon2id$one",
          },
          {
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
            username: "ops_one",
            email: "ops@example.org",
            name: "One",
            passwordHash: "$argon2id$one",
          },
          {
            username: "ops_two",
            email: "OPS@example.org",
            name: "Two",
            passwordHash: "$argon2id$two",
          },
        ]),
      ),
    ).toThrow("Duplicate bootstrap admin email");
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
