# Admin Bootstrap Design

## Problem

Eulesia currently treats platform admin as a normal user role:

- `users.role` includes `"admin"` in [apps/api/src/db/schema.ts](../apps/api/src/db/schema.ts)
- admin routes check `req.user.role === "admin"` in [apps/api/src/middleware/admin.ts](../apps/api/src/middleware/admin.ts)
- the admin UI can promote any user to `"admin"` through [apps/api/src/routes/admin.ts](../apps/api/src/routes/admin.ts)

This has two problems:

1. Initial admin bootstrap is operationally unsafe.
   Today the practical path is to get root access to the host and mutate Postgres directly.
2. Admin privilege is not part of declared infrastructure state.
   Nix + SOPS already bootstrap runtime secrets, but not privileged identities.

## Current Constraints

- Runtime secret delivery is already standardized through SOPS + Nix into `/run/secrets/eulesia/*`:
  - [docs/secrets.md](./secrets.md)
  - [nix/hosts/lib/eulesia-secrets.nix](../nix/hosts/lib/eulesia-secrets.nix)
  - [nix/modules/eulesia.nix](../nix/modules/eulesia.nix)
- The API service already has a natural DB bootstrap hook:
  - [nix/modules/eulesia.nix](../nix/modules/eulesia.nix) runs migrations in `systemd.services.eulesia-api.preStart`
- Admin is currently coupled into several surfaces:
  - backend route guard logic
  - websocket authorization
  - frontend route protection in [src/App.tsx](../src/App.tsx)
  - admin user-management UI in [src/pages/admin/AdminUserDetailPage.tsx](../src/pages/admin/AdminUserDetailPage.tsx)

## Recommendation

Use a two-phase approach.

### Phase 1: Dedicated Bootstrap-Managed Admin Accounts

This is the recommended next implementation.

Keep `users.role = "admin"` for now, but stop treating admin promotion as an in-app mutable status for arbitrary user accounts.

Instead:

1. Introduce dedicated admin login accounts that are bootstrapped from SOPS/Nix.
2. Store their account definitions in an encrypted structured secret file such as:
   - `secrets/test/admin-accounts.json.enc`
   - `secrets/prod/admin-accounts.json.enc`
3. Add a Nix option like:
   - `services.eulesia.auth.bootstrapAdminAccountsFile`
4. Decrypt that file into `/run/secrets/eulesia/admin-accounts.json`.
5. Run an idempotent bootstrap step in API `preStart` after migrations:
   - create missing admin accounts
   - update managed admin profile fields
   - seed missing passwords and preserve user-changed passwords by default
   - allow an explicit one-shot password reseed for recovery
   - ensure managed accounts keep `role = "admin"`
   - ensure managed accounts are tagged as operator accounts
6. Remove or narrow the in-app role-change path so it cannot mint new admins from arbitrary user accounts.

This gives us:

- declarative admin bootstrap
- no manual `psql` mutation
- reproducible host rebuilds
- a clean “source of truth” for initial admin access

### Phase 2: Split Platform Privilege from User Persona

This is cleaner architecturally, but it is a larger change.

Instead of encoding admin inside `users.role`, introduce a separate privilege relation such as:

- `platform_admins(user_id, managed_source, created_at, disabled_at, ...)`

Then:

- `users.role` becomes product-facing only, for example `citizen | institution`
- auth/session loading attaches `isAdmin` separately
- admin routes and frontend admin gating check `isAdmin`
- admin account bootstrap manages membership in `platform_admins`

This avoids conflating:

- what kind of product account a user is
- what platform-level operator powers they have

It also makes it easier later to model:

- moderators
- operators
- infra-managed staff accounts
- emergency break-glass accounts

## Why Phase 1 First

Phase 1 solves the operational security problem without forcing a broad refactor across:

- API route contracts
- frontend auth types
- search indexing
- user profile rendering
- moderation and sanction logic

The unsafe part today is not mainly that admin is a role enum. The unsafe part is that privileged access is bootstrapped manually outside declarative infrastructure.

Fix that first.

## Proposed Secret Shape

Use a structured SOPS file. Prefer password hashes over plaintext passwords.

Example:

```json
[
  {
    "managedKey": "ops_elli",
    "username": "ops_elli",
    "email": "ops.elli@example.invalid",
    "name": "Elli Esimerkki",
    "passwordHash": "$argon2id$..."
  },
  {
    "managedKey": "ops_matti",
    "username": "ops_matti",
    "email": "ops.matti@example.invalid",
    "name": "Matti Malli",
    "passwordHash": "$argon2id$...",
    "reseedPassword": true
  }
]
```

Why password hashes:

- the app only needs the hash
- plaintext passwords do not need to live in repo-managed secrets
- operators can generate and store the plaintext separately in a password manager
- `reseedPassword: true` is an explicit one-shot recovery flag, not steady-state configuration

The implemented schema is:

- `managedKey`
- `username`
- optional `email`
- `name`
- `passwordHash`
- optional `reseedPassword`

`managedKey` is the immutable reconciliation key for that bootstrap-managed identity. Keep it stable when renaming `username` or `email`. Changing `managedKey` intentionally creates a different managed identity.

Runtime operator ownership is still applied by bootstrap as `users.managedBy = "sops_admin"`.

For the current operational runbook, see [Admin Surface](./admin-surface.md).

## Recommended Metadata Model For Phase 1

Do not rely only on `users.role = "admin"` and do not overload `identityProvider` if we can avoid it.

`identityProvider` already carries authentication or account provenance such as `ftn`, `magic_link`, `managed`, and `eulesia-bot`. Using it for infra ownership would blur two different concerns:

- how this account authenticates or originated
- whether this account is an infra-managed operator account

For the first implementation, add one explicit marker for operator accounts, for example:

- `managedBy = "sops_admin"`
- `accountClass = "operator"`

This marker is what bootstrap owns. `role = "admin"` remains the runtime privilege switch for now because it is already wired through backend, websocket, and frontend checks.

## Bootstrap Behavior

The bootstrap script should be idempotent and conservative.

Recommended behavior:

1. Match managed admin accounts by stable key:
   - first `managedKey`
   - then legacy `email` / `username` matches while older rows are being backfilled
2. If absent, create the account.
3. If present, update only managed fields:
   - `managedKey`
   - `email`
   - `username`
   - `name`
   - `role = "admin"`
4. Treat `passwordHash` as a seed password:
   - apply it when creating the account
   - apply it when the stored password hash is empty or null
   - otherwise preserve the user-changed password
   - allow an explicit one-shot reseed flag for recovery
5. Mark the account as managed by bootstrap.
6. Do not delete accounts just because they were removed from the secret file.
7. If we need declarative deprovisioning, support it explicitly with a field such as:
   - `disabled: true`
   - `locked: true`
   - `active: false`

Without an explicit marker and explicit disable flow, removing an account from the secret file would be ambiguous and risky.

## Required Product Changes For Phase 1

### Backend

- Add bootstrap-admin config/env plumbing
- add an idempotent bootstrap script or CLI to the API package
- run it from `systemd.services.eulesia-api.preStart`
- remove admin promotion from `PATCH /admin/users/:id/role`
  - restrict that route to `citizen | institution`
  - or remove it entirely if role changes are no longer needed there

### Frontend

- remove the “promote to admin” flow from the admin user detail page
- leave admin dashboard access based on the authenticated user being an admin account

### Search / Discovery

Decide whether bootstrap admin accounts should appear in user search or public profile surfaces.

Recommended default: they should not appear in user search or public discovery.

If we follow that model, we should explicitly exclude them from:

- search indexing
- public user discovery
- profile suggestion surfaces

That can be done in phase 1 if we tag them distinctly with dedicated operator-account metadata.

## Open Questions

1. Should admin accounts be allowed to exist only as dedicated operator accounts, with no civic/social presence?
2. Do we want declarative removal of managed admins, or only declarative creation/update in the first version?
3. Do we want a later distinction between:
   - platform admins
   - moderators
   - institution claim reviewers
4. Should bootstrap admin accounts eventually require a second factor or FTN-backed step-up authentication?
5. Do we want one break-glass admin account in addition to named personal operator accounts?

## Suggested Next Implementation Scope

Recommended next PR scope:

1. Add `admin-accounts.json.enc` support in secrets + Nix.
2. Add API bootstrap script and run it from `preStart`.
3. Tag bootstrap-managed admin accounts distinctly.
4. Remove in-app promotion to `"admin"`.
5. Keep `users.role = "admin"` for now.

Recommended later PR scope:

1. Introduce `platform_admins`.
2. Replace `role === "admin"` checks with `isAdmin`.
3. Reduce `users.role` back to product persona only.
