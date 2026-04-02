# Admin Surface

## Overview

Eulesia platform administration uses a dedicated admin account system that is fully separated from regular user accounts.

Admin accounts live in the `admin_accounts` table, authenticate through `admin_sessions`, and use their own auth endpoints and cookie (`admin_session`). They do not appear in user queries, search, or public discovery.

Admin access is enforced by `adminAuthMiddleware` in [apps/api/src/middleware/adminAuth.ts](../apps/api/src/middleware/adminAuth.ts), which validates the `admin_session` cookie against the `admin_sessions` table.

## Backend Admin API Surface

### Admin Auth

Auth endpoints are mounted under `/api/v1/admin/auth` in [apps/api/src/routes/admin-auth.ts](../apps/api/src/routes/admin-auth.ts):

- `POST /admin/auth/login` -- username + password login
- `POST /admin/auth/logout` -- end admin session
- `GET /admin/auth/me` -- current admin account
- `POST /admin/auth/change-password` -- change admin password

### Admin Management

Management endpoints are mounted under `/api/v1/admin` in [apps/api/src/routes/admin.ts](../apps/api/src/routes/admin.ts) and require `adminAuthMiddleware`:

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

The admin panel is served from a dedicated subdomain:

- Production: `admin.eulesia.org`
- Test: `admin.test.eulesia.org`

Authentication uses the `useAdminAuth` hook in [src/hooks/useAdminAuth.tsx](../src/hooks/useAdminAuth.tsx).

The admin login page is at `/admin/login` via [src/pages/admin/AdminLoginPage.tsx](../src/pages/admin/AdminLoginPage.tsx).

The current admin pages include:

- `/admin` -- dashboard
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

## Bootstrap-Managed Admin Accounts

Admin accounts are bootstrapped from a SOPS-managed structured secret:

- `secrets/test/admin-accounts.json.enc`
- `secrets/prod/admin-accounts.json.enc`

The NixOS module exposes that file through:

- `services.eulesia.auth.bootstrapAdminAccountsFile`

At runtime the file is decrypted to:

- `/run/secrets/eulesia/admin-accounts.json`

Then `systemd.services.eulesia-api.preStart` runs the idempotent bootstrap step after migrations:

- create missing admin accounts in `admin_accounts`
- update managed account details
- hash and seed a plaintext password for new accounts or accounts with a missing password hash
- preserve operator-changed passwords by default
- allow an explicit one-shot password reseed when requested in the secret file
- keep managed accounts tagged with `managedBy = "sops_admin"`

The bootstrap implementation refuses to take over an existing non-managed account row.

For the full design and secret shape, see [Admin Bootstrap Design](./admin-bootstrap-design.md).

## Secret Shape

`admin-accounts.json.enc` is a JSON array of dedicated operator accounts using **plaintext passwords** (hashed at bootstrap time).

Example:

```json
[
  {
    "managedKey": "ops_elli",
    "username": "ops_elli",
    "name": "Elli Esimerkki",
    "password": "replace-with-plaintext-password"
  },
  {
    "managedKey": "ops_matti",
    "username": "ops_matti",
    "email": "ops.matti@example.invalid",
    "name": "Matti Malli",
    "password": "replace-with-plaintext-password"
  }
]
```

Notes:

- `managedKey` is required and must stay stable for the lifetime of that managed operator identity
- `password` is a **plaintext** seed password, hashed to Argon2 by the bootstrap script at runtime
- `password` is a seed password, not an always-authoritative password sync target
- `email` is optional; omitting it keeps the account out of email-based flows entirely
- removal from the file does not delete or disable the account automatically
- `reseedPassword: true` is an optional one-shot recovery switch that forces the seed password back onto the account during the next rebuild; remove it after the recovery build
- if a managed account's stored password hash is empty or null, the next bootstrap run reseeds it from `password`

## Operator Runbook

### Add a New Admin Account

1. Generate a password and store the plaintext in the operator password manager.
2. Add a new entry to `secrets/<env>/admin-accounts.json.enc` with `username`, optional `email`, `name`, and `password` (plaintext).
   Also assign a stable `managedKey` such as `ops_juliuskoskela`.
3. Re-encrypt and commit the updated secret file.
4. Deploy or rebuild the target host so `systemd.services.eulesia-api.preStart` runs the bootstrap sync. The bootstrap hashes the plaintext password at runtime.
5. Give the operator the plaintext seed password through the normal secure out-of-band channel.

### Rotate an Admin Password Normally

Normal rotation happens in the admin panel, not through SOPS:

1. Sign in at the admin subdomain (e.g. `admin.eulesia.org`).
2. Use `POST /api/v1/admin/auth/change-password`.
3. Keep the SOPS `password` entry unchanged.

Normal rebuilds preserve the operator-set password and do not overwrite it from the secret file.

### Recover a Lost Admin Password

If the operator has lost access, recover through infrastructure:

1. Generate a new password.
2. Update that account's `password` in `secrets/<env>/admin-accounts.json.enc`.
3. Add `"reseedPassword": true` to that same account entry.
4. Re-encrypt and deploy or rebuild the target host once.
5. Confirm the operator can sign in with the new seed password.
6. Remove `reseedPassword` from the secret file and deploy normally afterward.

That recovery rebuild forces the seed password back onto the account and revokes existing admin sessions for that account.

### Update Managed Profile Details

The bootstrap owns these fields on `admin_accounts`:

- `managedKey`
- `username`
- `email`
- `name`
- `managedBy = "sops_admin"`

To change those fields, edit the secret entry and rebuild the host. Keep `managedKey` stable when renaming `username` or `email`; it is the bootstrap reconciliation key.

### Deprovision an Admin Account

Removing an entry from `admin-accounts.json.enc` does not delete, disable, or demote the account.

Today deprovisioning is explicit and manual:

1. Remove or disable the account in the database with deliberate operator action.
2. Remove the account from the secret file so bootstrap stops managing it.
3. Deploy the updated host configuration.

There is no declarative disable or delete flag yet.
