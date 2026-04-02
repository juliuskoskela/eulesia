# Development Workflow

## Getting Started

See the [Deployment Guide](./deployment.md) for initial setup (`nix develop`, `just dev`).

## Agentic Skills

Claude Code skills are available for common development workflows. These are defined in `agents/skills/`:

| Skill       | Purpose                                        |
| ----------- | ---------------------------------------------- |
| `/impl`     | Implement a feature or change                  |
| `/check`    | Run quality checks                             |
| `/fix`      | Fix an issue with full diagnostics             |
| `/fix-fast` | Quick fix without full analysis                |
| `/resolve`  | Resolve a failing check or test                |
| `/ship`     | Prepare changes for merge (lint, test, commit) |
| `/plan`     | Create an implementation plan                  |
| `/review`   | Review code changes                            |

## Quality Gates

Run these before pushing:

```bash
just fmt         # Format all code (treefmt)
just lint        # Run all linters (nix, frontend, api)
just test        # Run all test suites (frontend, api)
just build       # Build frontend and API packages
just ci-check    # Run the full local CI pipeline (format + lint + test + build)
```

Individual lint/test commands:

```bash
nix run .#check-format    # Check formatting without writing
nix run .#lint            # All linters
nix run .#test            # All tests
```

## Pre-commit Hooks

Pre-commit hooks are installed automatically when entering `nix develop`. They run:

- `treefmt` -- formats all code
- `lint-nix` -- runs statix and deadnix on Nix files
- `lint-frontend` -- ESLint and TypeScript checking for the frontend
- `lint-api` -- ESLint and TypeScript checking for the API

## Branch Conventions

| Prefix    | Purpose                           |
| --------- | --------------------------------- |
| `feat/`   | New feature                       |
| `fix/`    | Bug fix                           |
| `triage/` | Investigation or triage           |
| `chore/`  | Maintenance, dependencies, config |
| `docs/`   | Documentation changes             |
| `design/` | Design or architecture work       |

## Fork Workflow

The project uses a fork-based workflow:

- `origin` -- your personal fork
- `upstream` -- `Eulesia/eulesia` (the main repository)

### PR Workflow

1. Create a branch from `main` with the appropriate prefix.
2. Push to `origin` (your fork).
3. Create a PR on `upstream` (`Eulesia/eulesia`).
4. CI runs on Mercury self-hosted runners.
5. Squash merge when approved.
6. Sync your fork's `main` with upstream after merge.

## Startup Migrations

Database schema changes are applied through startup migrations in `apps/api/src/db/startupMigrations.ts`. This module contains idempotent SQL statements that run every time the API starts.

In deployed environments, migrations run via the `eulesia-api-migrate` binary as part of `systemd.services.eulesia-api.preStart`, before the API process starts. The standalone runner script is at `apps/api/src/scripts/run-startup-migrations.ts`.

For local development, `just dev` starts the API which runs migrations on startup automatically.

See [Database Schema](./database-schema.md) for the full schema and migration details.
