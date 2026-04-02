# Admin Surface

## Overview

Eulesia currently exposes platform administration as an application-level privilege on user accounts.

The live authorization switch is still:

- `users.role = "admin"` in [apps/api/src/db/schema.ts](../apps/api/src/db/schema.ts)
- enforced by `requireAdmin()` in [apps/api/src/middleware/admin.ts](../apps/api/src/middleware/admin.ts)
- mirrored in frontend route gating in [src/App.tsx](../src/App.tsx)

This document describes the current admin surface and the intended bootstrap model for dedicated operator accounts.

## Backend Admin API Surface

All admin endpoints are mounted under `/api/v1/admin` in [apps/api/src/routes/index.ts](../apps/api/src/routes/index.ts) and require both:

- `authMiddleware`
- `requireAdmin`

The current backend admin surface is implemented in [apps/api/src/routes/admin.ts](../apps/api/src/routes/admin.ts) and covers:

- dashboard and aggregate stats
- user listing and user detail inspection
- user role changes between `citizen` and `institution`
- identity verification toggles
- sanctions and sanction revocation
- report queue and report resolution
- content removal and restoration
- moderation log and transparency stats
- appeals review
- registration and invite settings
- system announcements
- institution claim review
- waitlist review

Related non-`/admin` surfaces with inline admin checks also exist, for example institution claim approval in [apps/api/src/routes/institutions.ts](../apps/api/src/routes/institutions.ts).

## Frontend Admin Surface

Frontend admin routing is gated by `currentUser?.role === "admin"` in [src/App.tsx](../src/App.tsx).

The current admin pages include:

- `/admin`
- `/admin/users`
- `/admin/users/:id`
- `/admin/reports`
- `/admin/reports/:id`
- `/admin/modlog`
- `/admin/content`
- `/admin/transparency`
- `/admin/appeals`
- `/admin/institutions`
- `/admin/waitlist`
- `/admin/settings`

The navigation shell lives in [src/components/admin/AdminSidebar.tsx](../src/components/admin/AdminSidebar.tsx).

## Bootstrap-Managed Admin Accounts

Phase 1 keeps `users.role = "admin"` as the runtime privilege switch, but stops minting admin privilege from the application UI.

Instead, dedicated operator accounts are bootstrapped from a SOPS-managed structured secret:

- `secrets/test/admin-accounts.json.enc`
- `secrets/prod/admin-accounts.json.enc`

The NixOS module exposes that file through:

- `services.eulesia.auth.bootstrapAdminAccountsFile`

At runtime the file is decrypted to:

- `/run/secrets/eulesia/admin-accounts.json`

Then `systemd.services.eulesia-api.preStart` runs an idempotent bootstrap step after schema sync:

- create missing dedicated admin accounts
- update managed account details
- seed a password for new accounts or accounts whose password hash is missing
- preserve user-changed passwords by default
- allow an explicit one-shot password reseed when requested in the secret file
- keep managed accounts on `role = "admin"`
- tag those rows with `managedBy = "sops_admin"`

The bootstrap implementation intentionally refuses to take over an existing non-managed user row. That keeps the transition conservative: dedicated operator accounts should be created explicitly rather than silently converting an arbitrary citizen or institution account into infra-managed admin state.

## Public Exposure Rules

Bootstrap-managed operator accounts are treated as non-public operational identities.

They should not appear in:

- public user profiles
- user search
- public discovery surfaces

They also should not be mutable from normal end-user flows. In Phase 1 that means:

- admin promotion is removed from the in-app role editor
- magic-link login is disabled for SOPS-managed operator accounts
- self-service profile changes only allow notification and locale settings
- self-service password changes are allowed so operators can rotate away from the seed password
- self-service account deletion is blocked for SOPS-managed operator accounts

## Secret Shape

`admin-accounts.json.enc` is a JSON array of dedicated operator accounts.

Example:

```json
[
  {
    "managedKey": "ops_elli",
    "username": "ops_elli",
    "name": "Elli Esimerkki",
    "passwordHash": "$argon2id$..."
  },
  {
    "managedKey": "ops_matti",
    "username": "ops_matti",
    "email": "ops.matti@example.invalid",
    "name": "Matti Malli",
    "passwordHash": "$argon2id$..."
  }
]
```

Notes:

- `managedKey` is required and must stay stable for the lifetime of that managed operator identity
- `passwordHash` is preferred over plaintext passwords
- `passwordHash` is a seed password, not an always-authoritative password sync target
- `email` is optional; omitting it keeps the account out of the magic-link flow entirely
- removal from the file does not delete or disable the account automatically
- `reseedPassword: true` is an optional one-shot recovery switch that forces the seed password back onto the account during the next rebuild; remove it after the recovery build
- if a managed account's stored password hash is empty or null, the next bootstrap run reseeds it from `passwordHash`
- if declarative deprovisioning is needed later, it should be implemented explicitly rather than by omission

## Operator Runbook

This is the current operational procedure for managing bootstrap-managed admin accounts.

### Add a New Admin Account

1. Generate a password and store the plaintext in the operator password manager.
2. Generate an Argon2 hash for that password from the repo root:

   ```bash
   node --input-type=module -e 'import argon2 from "argon2"; console.log(await argon2.hash(process.argv[1]))' 'replace-with-plaintext-password'
   ```

3. Add a new entry to `secrets/<env>/admin-accounts.json.enc` with `username`, optional `email`, `name`, and `passwordHash`.
   Also assign a stable `managedKey` such as `ops_juliuskoskela`.
4. Re-encrypt and commit the updated secret file.
5. Deploy or rebuild the target host so `systemd.services.eulesia-api.preStart` runs the bootstrap sync.
6. Give the operator the plaintext seed password through the normal secure out-of-band channel.

### Rotate an Admin Password Normally

Normal rotation happens in the app, not through SOPS:

1. Sign in as the operator account.
2. Use `POST /users/me/password` or the profile password form.
3. Keep the SOPS `passwordHash` entry unchanged.

Normal rebuilds preserve the user-set password and do not overwrite it from the secret file.

### Recover a Lost Admin Password

If the operator has lost access, recover through infrastructure:

1. Generate a new password and Argon2 hash.
2. Update that account's `passwordHash` in `secrets/<env>/admin-accounts.json.enc`.
3. Add `"reseedPassword": true` to that same account entry.
4. Re-encrypt and deploy or rebuild the target host once.
5. Confirm the operator can sign in with the new seed password.
6. Remove `reseedPassword` from the secret file and deploy normally afterward.

That recovery rebuild forces the seed password back onto the account and revokes existing sessions for that user.

### Update Managed Profile Details

The bootstrap owns these fields:

- `managedKey`
- `username`
- `email`
- `name`
- `role = "admin"`
- `managedBy = "sops_admin"`

To change those fields, edit the secret entry and rebuild the host. Keep `managedKey` stable when renaming `username` or `email`; it is the bootstrap reconciliation key. In-app profile editing does not own them for bootstrap-managed accounts.

### Deprovision an Admin Account

Removing an entry from `admin-accounts.json.enc` does not delete, disable, or demote the account.

Today deprovisioning is explicit and manual:

1. remove or change the account's admin privilege in the application or database with deliberate operator action
2. remove the account from the secret file so bootstrap stops managing it
3. deploy the updated host configuration

There is no declarative disable or delete flag yet.
