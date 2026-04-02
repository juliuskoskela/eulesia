# Admin Bootstrap Design

## Architecture

Admin accounts are fully separated from regular users. They live in their own `admin_accounts` table and authenticate through their own `admin_sessions` table using a dedicated `admin_session` cookie.

This separation means:

- admins are not visible in user queries, search, or public discovery
- admin authentication and sessions are independent of the citizen/institution session system
- the `users` table no longer carries `managed_by` or `managed_key` columns
- moderation tables (`content_reports`, `moderation_actions`, `user_sanctions`, `moderation_appeals`, `waitlist`, `invite_codes`) reference admin IDs without foreign keys (FKs dropped to avoid cross-table constraints)

## Bootstrap Flow

Admin accounts are bootstrapped from SOPS-managed structured secrets:

- `secrets/test/admin-accounts.json.enc`
- `secrets/prod/admin-accounts.json.enc`

The NixOS module exposes:

- `services.eulesia.auth.bootstrapAdminAccountsFile`

At runtime the file is decrypted to:

- `/run/secrets/eulesia/admin-accounts.json`

The API service `preStart` runs two steps in order:

1. `eulesia-api-migrate` -- applies startup migrations from `apps/api/src/db/startupMigrations.ts`
2. `eulesia-api-bootstrap-admins` -- runs the idempotent bootstrap sync from `apps/api/src/scripts/bootstrap-admins.ts`

## Bootstrap Behavior

The bootstrap script is idempotent and conservative:

1. Match managed admin accounts by stable key (`managedKey`), then by `email` or `username` for legacy migration.
2. If absent, create the account in `admin_accounts` with the hashed seed password.
3. If present, update managed fields: `username`, `email`, `name`, `managedKey`.
4. Treat `password` as a seed password:
   - apply it when creating the account
   - apply it when the stored password hash is empty or null
   - otherwise preserve the operator-changed password
   - honor `reseedPassword: true` as a one-shot recovery flag
5. Refuse to adopt an existing non-managed account (throws an error).
6. Removal from the secret file does not delete or disable the account.

## Secret Shape

`admin-accounts.json.enc` is a JSON array. The bootstrap expects **plaintext passwords**, which are hashed at runtime by the bootstrap script using Argon2.

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
    "password": "replace-with-plaintext-password",
    "reseedPassword": true
  }
]
```

Field details:

- `managedKey` -- required, immutable reconciliation key. Keep stable when renaming `username` or `email`.
- `username` -- required, 3-50 characters, alphanumeric plus underscore.
- `email` -- optional. Omitting it keeps the account out of any email-based flows.
- `name` -- required display name.
- `password` -- required plaintext seed password. Hashed to Argon2 at bootstrap time.
- `reseedPassword` -- optional one-shot recovery flag. Forces the seed password back onto the account and revokes admin sessions. Remove after recovery.

## Admin Auth Endpoints

Admin authentication uses a separate set of endpoints under `/api/v1/admin/auth`:

- `POST /admin/auth/login` -- authenticate with username + password, sets `admin_session` cookie
- `POST /admin/auth/logout` -- clears the admin session
- `GET /admin/auth/me` -- returns the authenticated admin account
- `POST /admin/auth/change-password` -- change the admin password

These endpoints operate against `admin_accounts` and `admin_sessions`, completely independent of the citizen auth flow.

## Frontend

The admin panel uses:

- `useAdminAuth` hook for authentication state
- `AdminLoginPage` at `/admin/login`
- Admin dashboard and management pages under `/admin/*`

The admin panel is served from a dedicated subdomain (`admin.eulesia.org` in production, `admin.test.eulesia.org` in test). See [Deployment](./deployment.md) for subdomain setup.

## Cookie Domain

Admin sessions use the `admin_session` cookie with a domain-scoped cookie:

- Production: `.eulesia.org` (via `services.eulesia.auth.cookieDomain`)
- Test: `.test.eulesia.org`

This allows cross-subdomain session sharing between `admin.*` and the main app domain.

## Prior Design Phases

The original design proposed two phases:

1. **Phase 1** -- dedicated bootstrap-managed admin accounts in the `users` table with `managedBy = "sops_admin"`.
2. **Phase 2** -- split admin into a separate table.

Both phases are now complete. Admin accounts are fully separated from users in their own `admin_accounts` table with dedicated sessions, auth endpoints, and frontend routing.
