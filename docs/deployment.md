# Eulesia Deployment Guide

## Overview

Eulesia now treats Nix as the canonical path for:

- local development
- build outputs
- deployment configuration
- CI entrypoints

The flake exposes:

- `nix develop` and `just` for developer workflow
- `nix run .#ci-check` for runner-agnostic CI checks
- `nixosModules.eulesia` for reusable service configuration
- `nixosConfigurations.eulesia-vm` for VM validation
- `nixosConfigurations.eulesia-prod` and `nix run .#deploy` for production deployment

The old Docker Compose setup is deprecated and should only be treated as a temporary fallback while the production host is migrated.

## Local Validation

```bash
nix develop
just dev
```

This starts:

- PostgreSQL
- Meilisearch
- API on `http://localhost:3001`
- frontend on `http://localhost:5173`

Useful validation commands:

```bash
just lint
just test
just build
just vm-build
nix run .#ci-check
```

## NixOS Module

The reusable deployment surface lives in `nixosModules.eulesia`.

It configures:

- the packaged API service
- the packaged frontend served by nginx
- local PostgreSQL and Meilisearch when enabled
- uploads storage
- TLS termination through nginx + ACME
- environment and secret injection for the API

The module interface is centered on `services.eulesia.*`, including:

- `package` and `frontendPackage`
- `appDomain` and `apiDomain`
- `database.{createLocally,name,user,url}`
- `meilisearch.{createLocally,listenAddress,listenPort,url,masterKeyFile}`
- `auth.sessionSecretFile`
- `email.smtp.{host,port,secure,userFile,passFile}`
- `push.{vapidPublicKeyFile,vapidPrivateKeyFile,vapidSubject,firebaseServiceAccountKeyFile}`
- `ai.{mistralApiKeyFile,mistralModel}`
- `extraEnvironment`
- `extraSecretEnvironmentFiles`

## Production Configuration

`nixosConfigurations.eulesia-prod` is the production-oriented host definition currently wired into the deploy target.

Current assumptions in the repo:

- deploy target host: `95.216.206.136`
- SSH user: `root`
- domains: `eulesia.eu` and `api.eulesia.eu`
- managed runtime secrets should live under `secrets/prod/` and `secrets/test/`
- one encrypted file per secret, using names such as `session-secret.enc` and `firebase-service-account.json.enc`
- `sops-nix` materializes runtime secret files under `/run/secrets/eulesia/`

Before the first real NixOS deployment, verify and adjust:

- disk layout in the production host config
- SSH access
- all secret file paths
- Idura/OAuth values in `extraEnvironment`

## Required Secrets

The canonical inventory, purpose, and generation guidance lives in [Secrets](./secrets.md).

Production runtime still expects these decrypted files under `/run/secrets/eulesia/`:

- `/run/secrets/eulesia/session-secret`
- `/run/secrets/eulesia/meili-master-key`
- `/run/secrets/eulesia/mistral-api-key`
- `/run/secrets/eulesia/smtp-user`
- `/run/secrets/eulesia/smtp-pass`
- `/run/secrets/eulesia/vapid-public-key`
- `/run/secrets/eulesia/vapid-private-key`
- `/run/secrets/eulesia/firebase-service-account.json`
- `/run/secrets/eulesia/idura-client-secret`

## Deploy

Build and deploy through the flake:

```bash
nix build .#nixosConfigurations.eulesia-prod.config.system.build.toplevel
nix run .#deploy
```

`nix run .#deploy` uses `deploy-rs` and activates the `eulesia-prod` node from the flake.

If `$HOME/.config/sops/age/keys.txt` exists locally, the deploy app copies it to `/var/lib/sops-nix/key.txt` on the target before running `deploy-rs`.

The API service runs database migration as a pre-start step, so configuration switches restart the app against the current schema automatically.

## VM Target

Use the VM configuration to validate the service stack without touching production:

```bash
nix build .#nixosConfigurations.eulesia-vm.config.system.build.vm
```

The VM config uses:

- plain HTTP
- local PostgreSQL
- local Meilisearch
- packaged frontend + API from this flake

## Legacy Docker Assets

The following remain in the repo during the migration period:

- `docker/docker-compose.yml`
- `docker/docker-compose.prod.yml`
- `docker/Dockerfile.*`
- `scripts/deploy.sh`
- `scripts/setup-server.sh`

They are no longer the primary deployment path and should not be extended further unless the Nix migration is blocked.
