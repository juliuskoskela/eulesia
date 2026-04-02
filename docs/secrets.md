# Eulesia Secrets

## Overview

Eulesia runtime secrets should be stored as one encrypted file per secret.

- Encryption mechanism: SOPS + Age
- Environment directories: `secrets/test/` and `secrets/prod/`
- Scalar secrets use `.enc`, for example `session-secret.enc`
- Structured file secrets keep their type hint, for example `firebase-service-account.json.enc`

The application never reads these `.enc` files directly. Deployment decrypts them into runtime files under `/run/secrets/eulesia/`, and the NixOS module injects those files into the API environment.

Local development is mostly separate from this flow. It uses defaults plus local `.env` files and is not the managed runtime secret inventory.

## Layout

```text
secrets/
  test/
    admin-accounts.json.enc
    session-secret.enc
    meili-master-key.enc
    mistral-api-key.enc
    smtp-user.enc
    smtp-pass.enc
    vapid-public-key.enc
    vapid-private-key.enc
    firebase-service-account.json.enc
    idura-signing-key.jwk.json.enc
    idura-encryption-key.jwk.json.enc
  prod/
    admin-accounts.json.enc
    session-secret.enc
    meili-master-key.enc
    mistral-api-key.enc
    smtp-user.enc
    smtp-pass.enc
    vapid-public-key.enc
    vapid-private-key.enc
    firebase-service-account.json.enc
    idura-signing-key.jwk.json.enc
    idura-encryption-key.jwk.json.enc
```

Runtime filenames drop the trailing `.enc`. For example:

- `secrets/prod/admin-accounts.json.enc` becomes `/run/secrets/eulesia/admin-accounts.json`
- `secrets/prod/session-secret.enc` becomes `/run/secrets/eulesia/session-secret`
- `secrets/prod/firebase-service-account.json.enc` becomes `/run/secrets/eulesia/firebase-service-account.json`

## Secret Inventory

| Secret file                         | Environments                       | Runtime consumer                                                                       | Purpose                                                                              | Generation or source                                                            |
| ----------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `admin-accounts.json.enc`           | `test`, `prod`                     | `/run/secrets/eulesia/admin-accounts.json` -> `BOOTSTRAP_ADMIN_ACCOUNTS_FILE`          | Declarative bootstrap of dedicated admin accounts and their seed passwords           | Maintain as structured JSON with plaintext passwords (hashed at bootstrap time) |
| `session-secret.enc`                | `test`, `prod`                     | `/run/secrets/eulesia/session-secret` -> `SESSION_SECRET`                              | Signs app sessions and FTN/Idura flow session state                                  | Generate locally with a random 32+ byte secret                                  |
| `meili-master-key.enc`              | `test`, `prod`                     | `/run/secrets/eulesia/meili-master-key` -> `MEILI_MASTER_KEY`                          | Protects Meilisearch admin access and API writes                                     | Generate locally with a random high-entropy secret                              |
| `mistral-api-key.enc`               | `test`, `prod`                     | `/run/secrets/eulesia/mistral-api-key` -> `MISTRAL_API_KEY`                            | Enables Mistral-backed import summarization                                          | Create in the Mistral console                                                   |
| `smtp-user.enc`                     | `test`, `prod`                     | `/run/secrets/eulesia/smtp-user` -> `SMTP_USER`                                        | SMTP authentication username                                                         | Obtain from the SMTP provider                                                   |
| `smtp-pass.enc`                     | `test`, `prod`                     | `/run/secrets/eulesia/smtp-pass` -> `SMTP_PASS`                                        | SMTP authentication password                                                         | Obtain from the SMTP provider                                                   |
| `vapid-public-key.enc`              | `test`, `prod`                     | `/run/secrets/eulesia/vapid-public-key` -> `VAPID_PUBLIC_KEY`                          | Public half of the web push keypair returned to clients                              | Generate together with the private key using `web-push`                         |
| `vapid-private-key.enc`             | `test`, `prod`                     | `/run/secrets/eulesia/vapid-private-key` -> `VAPID_PRIVATE_KEY`                        | Private half of the web push keypair used for push signing                           | Generate together with the public key using `web-push`                          |
| `firebase-service-account.json.enc` | `test`, `prod` when FCM is enabled | `/run/secrets/eulesia/firebase-service-account.json` -> `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK credentials for native push notifications                         | Download a service account JSON from Firebase / Google Cloud                    |
| `idura-signing-key.jwk.json.enc`    | `test`, `prod`                     | `/run/secrets/eulesia/idura-signing-key.jwk.json` -> `IDURA_SIGNING_KEY_FILE`          | Private JWK used to sign FTN request objects and `private_key_jwt` client assertions | Generate locally with `just generate-idura-jwks`                                |
| `idura-encryption-key.jwk.json.enc` | `test`, `prod`                     | `/run/secrets/eulesia/idura-encryption-key.jwk.json` -> `IDURA_ENCRYPTION_KEY_FILE`    | Private JWK used to decrypt encrypted FTN `id_token` responses                       | Generate locally with `just generate-idura-jwks`                                |

## Generation and Acquisition

### Session Secret

Generate a long random secret locally. It must be at least 32 bytes after decoding.

```bash
openssl rand -base64 48
```

Use a different value for `test` and `prod`.

### Bootstrap Admin Accounts

Create a structured JSON file for dedicated operator accounts and encrypt it as `admin-accounts.json.enc`.

The secret file stores **plaintext passwords**. The bootstrap script hashes them to Argon2 at runtime. This simplifies the operator workflow -- there is no need to pre-generate hashes.

Example shape:

```json
[
  {
    "managedKey": "ops_elli",
    "username": "ops_elli",
    "name": "Elli Esimerkki",
    "password": "replace-with-plaintext-password"
  }
]
```

`managedKey` is required and must remain stable for the lifetime of that managed operator identity. It is the immutable bootstrap reconciliation key, so username/email renames should keep the same `managedKey`.

`email` is optional. If you omit it, the account stays out of email-based flows.

`password` is a seed password. It is applied when the account is first created and when the stored password hash is missing, but normal rebuilds do not overwrite a password that the operator has later changed through the admin panel.

If a password must be recovered through infrastructure, add `"reseedPassword": true` to the relevant account entry for one rebuild. That forces the seed password back onto the account and revokes existing admin sessions. Remove the flag again after the recovery build so future rebuilds go back to preserving the operator-set password.

For the full add, rotate, recover, and deprovision runbook, see [Admin Surface](./admin-surface.md).

### Meilisearch Master Key

Generate another independent high-entropy secret:

```bash
openssl rand -base64 48
```

Do not reuse the session secret here.

### Mistral API Key

Create an API key in the Mistral account used for Eulesia imports. Store only the key value.

### SMTP Credentials

Provision SMTP credentials from the mail provider used for transactional email. Store the username and password as separate secret files.

### VAPID Keypair

Generate the push keypair with the same toolchain the app already expects:

```bash
npx web-push generate-vapid-keys
```

Store the public and private values in separate secret files. `VAPID_SUBJECT` is configuration, not a secret.

### Firebase Service Account JSON

Create or reuse a Google Cloud service account for Firebase Admin usage, then download the JSON credential file. Encrypt the full JSON document as `firebase-service-account.json.enc`.

Production currently runs with Firebase native push disabled. Do not add a prod Firebase secret until you are ready to enable FCM on the production host again.

### Idura FTN Key Material

Generate FTN-ready signing and encryption keys with:

```bash
just generate-idura-jwks local/idura-jwks
```

By default this creates:

- an `ES256` P-256 signing key
- an `RSA-OAEP-256` encryption key

This creates:

- `idura-signing-key.jwk.json`
- `idura-encryption-key.jwk.json`
- `idura-client-jwks.public.json`

Encrypt the two private JWK files into `secrets/<env>/`. Upload `idura-client-jwks.public.json` to the matching Idura application as the static client JWKS. The public JWKS is operator material, not a runtime secret, and should stay out of the encrypted secret tree.

If you are syncing Eulesia to an existing Idura application, do not generate a new keypair. Encrypt the matching existing private JWKs instead. For the current test tenant, the matching private operator material is kept locally in the untracked `local/jwks.private.json`.

## Non-Secret Adjacent Config

These values are important, but they are not secrets and should not be stored as `.enc` files:

- `IDURA_CLIENT_ID`
- `IDURA_DOMAIN`
- `IDURA_CALLBACK_URL`
- `idura-client-jwks.public.json`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `EMAIL_FROM`
- `VAPID_SUBJECT`

## Handling Rules

- Generate or obtain the secret in plaintext outside the repo first.
- Encrypt it into the corresponding `*.enc` file.
- Do not commit plaintext secret files.
- Keep file names stable across environments so Nix and runtime paths stay predictable.
- For JSON credentials, preserve the original JSON payload and only add the `.enc` suffix.

## Secret Audit

Use the built-in audit helper before the first production bootstrap and before any public cutover:

```bash
just audit-prod-secrets
```

This decrypts every file under `secrets/prod/` and flags obvious placeholder values such as:

- `REPLACE_WITH_...`
- `replace-with-...`
- empty JSON objects like `{}`

It is a safety net, not a full semantic validator. A passing audit means the files are no longer obvious placeholders, not that every credential has been tested against the live provider.

## Developer Workstation Key Onboarding

Developers who need access to `secrets/test/*` should use a normal local SOPS Age key on their workstation.

If you already have Nix and this repo checked out, `nix develop` provides `age-keygen`, `sops`, and `just`. You do not need to install those tools separately.

Use this path:

```bash
~/.config/sops/age/keys.txt
```

If that file already exists, reuse it. Do not generate a second workstation key unless you are intentionally rotating or replacing your local SOPS identity.

If it does not exist yet, create it with:

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt
```

Print your public recipient with:

```bash
age-keygen -y ~/.config/sops/age/keys.txt
```

Send only the public `age1...` recipient to a maintainer, together with a stable label such as `firstname.lastname@company.com workstation`.

### Maintainer-side repo update

After receiving the developer's public recipient, a maintainer should:

1. Add a named or commented entry to `.sops.yaml`.
2. Include that recipient in the `secrets/test/*.enc` creation rule.
3. Re-encrypt the test secrets:

```bash
find secrets/test -name '*.enc' -print0 | xargs -0 -n1 sops updatekeys
```

4. Commit the `.sops.yaml` change together with the re-encrypted `secrets/test/*` files.

That repo update is what gives the developer access to the current test secret set.

### Developer verification

After the maintainer has committed the recipient update:

1. Pull the latest changes.
2. Verify that SOPS can decrypt a test secret locally:

```bash
sops -d secrets/test/session-secret.enc >/dev/null
```

3. Optionally validate that the test host configuration builds:

```bash
nix build .#nixosConfigurations.eulesia-test.config.system.build.toplevel --no-link
```

If decryption fails, the usual causes are:

- the wrong public recipient was added to `.sops.yaml`
- the test secrets were not re-encrypted after adding the key
- your workstation is not using `~/.config/sops/age/keys.txt`

### Access model

- Your workstation Age key allows local decryption of repo-managed secrets.
- It does not by itself grant SSH access to the test server.
- Direct workstation deploys also require your SSH public key to be authorized on the test host.
- GitHub Actions deploys use shared repo-level Actions variables and secrets plus Mercury runners, not per-developer Age keys.

For the full workstation and test-host flow, see [Deployment](./deployment.md).

## Current State

- `secrets/test/` now carries the full runtime secret surface, seeded from the local test values and fresh generated session, Meilisearch, and VAPID secrets.
- `secrets/prod/` now uses the same per-file shape, but several files still contain placeholders and must be replaced before any production deployment.
- `nixosConfigurations.eulesia-vm`, `eulesia-test`, and `eulesia-prod` all decrypt the same runtime filenames under `/run/secrets/eulesia/`.

For deployment details and runtime path wiring, see [Deployment](./deployment.md).
