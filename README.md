# Eulesia

**Civic social media as European digital public infrastructure**

[eulesia.eu](https://eulesia.eu)

Eulesia is an open-source civic platform that combines the social features people expect from modern social media — feeds, messaging, communities — with civic identity and institutional participation. No algorithms, no ads, no attention economy.

> _"The value proposition is not dopamine but efficacy: meaningful participation in decisions that matter."_

## What is Eulesia?

Commercial social media offers **agency without citizenship**: social functionality disconnected from civic structures. Existing civic tech offers **citizenship without agency**: formal participation without social fabric. Eulesia combines both — a digital public space where citizens interact as recognized members of a shared polity.

### Core Features

**Agora** — Public civic discussion with scope-based threads:

- **Local** — municipal issues anchored to administrative areas
- **National** — government decisions, legislation, ministry announcements
- **European** — EU legislation, Commission decisions, Parliament resolutions

AI-powered import of municipal meeting minutes, ministry press releases, and EU documents transforms bureaucratic content into accessible discussion threads.

**Clubs** — Community groups for interest-based civic organization with self-moderation.

**Home** — Personal spaces with public and private rooms for discussion hosting.

**Real-time messaging** — Direct messages and room-based chat with Socket.io.

### Design Principles

| Principle                   | Description                                                                   |
| --------------------------- | ----------------------------------------------------------------------------- |
| **Verified Identity**       | One-person-one-account via EUDI Wallet integration                            |
| **Institutional Anchoring** | Discussion spaces tied to administrative entities                             |
| **Anti-Attention Design**   | No engagement metrics, trending, viral amplification, or algorithmic curation |
| **Privacy by Default**      | GDPR compliance embedded architecturally                                      |
| **Public Governance**       | Operated under democratic accountability                                      |

## Tech Stack

| Layer      | Technology                                             |
| ---------- | ------------------------------------------------------ |
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS               |
| API        | Node.js, Express, Drizzle ORM                          |
| Database   | PostgreSQL                                             |
| Search     | Meilisearch (typo-tolerant, federated)                 |
| Real-time  | Socket.io (session-authenticated)                      |
| AI         | Mistral Large (EU-hosted, GDPR-compliant)              |
| Deployment | NixOS module, nginx, Traefik, nixos-rebuild, deploy-rs |

## Automated Content Import

Eulesia imports and summarizes official documents using [Mistral AI](https://mistral.ai):

| Source                                             | Scope    | Schedule            |
| -------------------------------------------------- | -------- | ------------------- |
| Municipal meeting minutes (CloudNC, Tweb, Dynasty) | Local    | 06:00, 18:00        |
| Valtioneuvosto, Finlex                             | National | 08:00, 14:00, 20:00 |
| European Commission, EUR-Lex, European Parliament  | European | 10:00, 16:00        |

AI-generated summaries are transparent (marked as "Eulesia summary — Generated with Mistral AI") and link to original sources.

## Development

### Prerequisites

- Nix with flakes enabled

For first-time workstation setup on Linux or macOS, developer onboarding, and test-host deployment, start with [Deployment](./docs/deployment.md) and [Secrets](./docs/secrets.md).

### Setup

```bash
# Enter the development environment
nix develop

# See the primary commands
just

# Start PostgreSQL, Meilisearch, API, and frontend together
just dev
```

Optional local secrets can be sourced from untracked files:

- `.env.local`
- `.env.development.local`
- `apps/api/.env.local`
- `apps/api/.env.development.local`

Managed runtime secrets should live as per-secret encrypted files under:

- `secrets/test/`
- `secrets/prod/`

The repo now uses one `*.enc` file per secret, with structured payloads kept as typed files such as `firebase-service-account.json.enc`. See [Secrets](./docs/secrets.md).

### Common Commands

```bash
just lint        # Nix lint + frontend lint/typecheck + API lint/typecheck
just test        # Frontend and API test suites
just build       # Build frontend + API bundle outputs
just db-migrate  # Apply schema changes locally
just db-reset    # Recreate the local PostgreSQL cluster and reapply schema
just vm-run      # Start the local MicroVM on localhost
just vm-deploy   # Hot-deploy the current system into the running VM
```

### Nix Outputs

```bash
nix build .#frontend
nix build .#api
nix build .#nixosConfigurations.eulesia-vm.config.microvm.runner.qemu
nix build .#nixosConfigurations.eulesia-test.config.system.build.toplevel
nix run .#rebuild-test
nix run .#ci-check
```

### Local VM

`just vm-run` starts the NixOS MicroVM used for local deployment validation and exposes the full service surface on `localhost`:

- `http://localhost:18080` for the app and proxied API
- `ssh root@localhost -p 2223`
- `http://localhost:17701/health` for Meilisearch

PostgreSQL is not exposed on the host by default.

Those three localhost ports must be free before the VM can start.

`just vm-deploy` pushes the current NixOS system into the running VM over SSH and bootstraps `/var/lib/sops-nix/key.txt` from `$HOME/.local/share/eulesia/vm-sops-age.key`.

The Docker Compose files remain in the repo as a legacy fallback during migration, but Nix is the primary development and deployment path.

## Authentication

| Method                 | Status     |
| ---------------------- | ---------- |
| Invite Code + Password | Production |
| EUDI Wallet (PID)      | Planned    |

## Documentation

- [Home System](./docs/home-system.md) — Personal spaces and rooms
- [EUDI Wallet Integration](./docs/eudi-wallet-integration.md) — European Digital Identity
- [Geospatial Integration](./docs/geospatial-integration.md) — Location-based features
- [API Reference](./docs/api-reference.md) — API endpoints
- [Database Schema](./docs/database-schema.md) — Data models
- [Deployment](./docs/deployment.md) — Nix install, onboarding, and deployment
- [Secrets](./docs/secrets.md) — Runtime secret inventory, generation, and Age key onboarding

## Academic Reference

Sjöberg, M. (2026). "Reclaiming the Digital Agora: A Design Science Approach to Identity-Based Civic Infrastructure Beyond the Attention Economy." MIPRO 2026, Tampere University/ITC.

## License

Licensed under the [European Union Public License v1.2](./LICENSE) (EUPL-1.2).

The EUPL is the European Commission's open-source license, designed for European public-sector software. It is compatible with GPL, LGPL, AGPL, MPL, and other major open-source licenses.
