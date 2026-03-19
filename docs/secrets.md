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
    session-secret.enc
    meili-master-key.enc
    mistral-api-key.enc
    smtp-user.enc
    smtp-pass.enc
    vapid-public-key.enc
    vapid-private-key.enc
    firebase-service-account.json.enc
    idura-client-secret.enc
  prod/
    session-secret.enc
    meili-master-key.enc
    mistral-api-key.enc
    smtp-user.enc
    smtp-pass.enc
    vapid-public-key.enc
    vapid-private-key.enc
    firebase-service-account.json.enc
    idura-client-secret.enc
```

Runtime filenames drop the trailing `.enc`. For example:

- `secrets/prod/session-secret.enc` becomes `/run/secrets/eulesia/session-secret`
- `secrets/prod/firebase-service-account.json.enc` becomes `/run/secrets/eulesia/firebase-service-account.json`

## Secret Inventory

| Secret file                         | Environments   | Runtime consumer                                                                       | Purpose                                                      | Generation or source                                         |
| ----------------------------------- | -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `session-secret.enc`                | `test`, `prod` | `/run/secrets/eulesia/session-secret` -> `SESSION_SECRET`                              | Signs app sessions and FTN/Idura flow session state          | Generate locally with a random 32+ byte secret               |
| `meili-master-key.enc`              | `test`, `prod` | `/run/secrets/eulesia/meili-master-key` -> `MEILI_MASTER_KEY`                          | Protects Meilisearch admin access and API writes             | Generate locally with a random high-entropy secret           |
| `mistral-api-key.enc`               | `test`, `prod` | `/run/secrets/eulesia/mistral-api-key` -> `MISTRAL_API_KEY`                            | Enables Mistral-backed import summarization                  | Create in the Mistral console                                |
| `smtp-user.enc`                     | `test`, `prod` | `/run/secrets/eulesia/smtp-user` -> `SMTP_USER`                                        | SMTP authentication username                                 | Obtain from the SMTP provider                                |
| `smtp-pass.enc`                     | `test`, `prod` | `/run/secrets/eulesia/smtp-pass` -> `SMTP_PASS`                                        | SMTP authentication password                                 | Obtain from the SMTP provider                                |
| `vapid-public-key.enc`              | `test`, `prod` | `/run/secrets/eulesia/vapid-public-key` -> `VAPID_PUBLIC_KEY`                          | Public half of the web push keypair returned to clients      | Generate together with the private key using `web-push`      |
| `vapid-private-key.enc`             | `test`, `prod` | `/run/secrets/eulesia/vapid-private-key` -> `VAPID_PRIVATE_KEY`                        | Private half of the web push keypair used for push signing   | Generate together with the public key using `web-push`       |
| `firebase-service-account.json.enc` | `test`, `prod` | `/run/secrets/eulesia/firebase-service-account.json` -> `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK credentials for native push notifications | Download a service account JSON from Firebase / Google Cloud |
| `idura-client-secret.enc`           | `test`, `prod` | `/run/secrets/eulesia/idura-client-secret` -> `IDURA_CLIENT_SECRET`                    | OIDC client secret for FTN / Idura authentication            | Obtain from Idura / Criipto when the client is provisioned   |

## Generation and Acquisition

### Session Secret

Generate a long random secret locally. It must be at least 32 bytes after decoding.

```bash
openssl rand -base64 48
```

Use a different value for `test` and `prod`.

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

### Idura Client Secret

Provision the FTN / Idura client in Idura or Criipto, then store the issued client secret. The client ID, domain, and callback URL are configuration values and should stay outside the secret inventory.

## Non-Secret Adjacent Config

These values are important, but they are not secrets and should not be stored as `.enc` files:

- `IDURA_CLIENT_ID`
- `IDURA_DOMAIN`
- `IDURA_CALLBACK_URL`
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

## Current State

- `secrets/test/` now carries the full runtime secret surface, seeded from the local test values and fresh generated session, Meilisearch, and VAPID secrets.
- `secrets/prod/` now uses the same per-file shape, but several files still contain placeholders and must be replaced before any production deployment.
- `nixosConfigurations.eulesia-vm`, `eulesia-test`, and `eulesia-prod` all decrypt the same runtime filenames under `/run/secrets/eulesia/`.

For deployment details and runtime path wiring, see [Deployment](./deployment.md).
