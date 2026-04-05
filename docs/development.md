# Development Workflow

## Getting Started

Enter the development shell (automatic with direnv, or `nix develop`):

```bash
cd eulesia          # direnv activates automatically
just dev            # start all services (postgres, meilisearch, server, frontend)
```

See [Architecture](./architecture.md) for the system boundary and module map.

## Project Structure

```
eulesia/
├── src/                    React frontend (v1 + v2 client)
├── crates/server/          Rust server
├── nix/                    Nix build system, modules, deployment
├── tests/e2e/              Playwright E2E tests
├── agents/skills/          Agentic development skills
└── docs/                   Documentation
```

### Two backends during transition

| **Location** | `crates/server/` |
| **Port** | 3002 |
| **API prefix** | `/api/v1/` and `/api/v2/` |
| **Build** | `cargo build -p eulesia-server` |
| **Test** | `cargo test -p eulesia-server` |
| **Nix build** | `nix build .#server` |

## Agentic Skills

Claude Code skills for common workflows, defined in `agents/skills/`:

| Skill       | Purpose                            |
| ----------- | ---------------------------------- |
| `/impl`     | Implement a feature or change      |
| `/check`    | Run quality checks                 |
| `/fix`      | Fix an issue with full diagnostics |
| `/fix-fast` | Quick fix without full analysis    |
| `/resolve`  | Resolve a failing check or test    |
| `/ship`     | Prepare changes for merge          |
| `/plan`     | Create an implementation plan      |
| `/review`   | Review code changes                |

Skills are context-aware: they detect whether changes are in `crates/` (Rust) or `apps/`/`src/` (JS/TS) and run the appropriate toolchain.

## Quality Gates

### Full pipeline

```bash
just ci-check       # format + lint + test + build (all components)
```

### By component

```bash
# All
just fmt             # Format all code (treefmt + cargo fmt)
just lint            # All linters
just test            # All test suites

# Frontend (React)
just build-web       # nix build .#frontend

# Server (Rust)
just build-server    # nix build .#server
cargo test           # Fast local Rust tests
cargo clippy         # Lint Rust code
cargo fmt --check    # Check Rust formatting
```

### Nix checks (run by `nix flake check`)

- `format` — treefmt
- `nix-lint` — statix + deadnix
- `frontend-lint`, `frontend-test`, `frontend-build`
- `api-lint`, `api-test`, `api-build`
- `server-clippy`, `server-test`, `server-fmt`
- `test-host-build`, `vm-build` (NixOS system builds)

## Pre-commit Hooks

Installed automatically by `nix develop` / direnv. Run on every commit:

- `treefmt` — formats all code (Nix, JS/TS, YAML, JSON)
- `lint-nix` — statix and deadnix
- `lint-frontend` — ESLint + TypeScript checking
- `lint-api` — ESLint + TypeScript checking

Rust formatting is handled by `treefmt` (which invokes `rustfmt`).

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

- `origin` — your personal fork
- `upstream` — `Eulesia/eulesia`

### PR Workflow

1. Create a branch from `main` with the appropriate prefix.
2. Push to `origin` (your fork).
3. Create a PR on `upstream`.
4. CI runs on Mercury self-hosted runners.
5. Squash merge when approved.
6. Sync fork main: `git fetch upstream && git merge upstream/main --ff-only && git push origin main`

## Database

### Migrations (SeaORM)

Schema managed by SeaORM migrations in `crates/db/src/migration/`. Applied automatically by the server binary on startup.

## Adding a New Endpoint

### v2 Server (Rust)

1. Define request/response types in the handler module (with `Serialize`/`Deserialize`)
2. Write the handler function in `crates/server/src/`
3. Register the route in `crates/server/src/router.rs`
4. Add tests (inline `#[cfg(test)]` module or integration test)
5. `cargo test` → `cargo clippy` → commit
