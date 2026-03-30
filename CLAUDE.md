# Secret Santa — Claude Code Instructions

## Project structure

Nx monorepo with pnpm workspaces:

```
apps/backend/   — NestJS 11 backend (REST API)
apps/web/       — Angular 21 frontend (standalone components)
libs/shared/    — Shared interfaces: ISessionRepository, SessionModel, Pair
docs/           — Architecture, local dev, GCP deployment guides
docs/adr/       — Architecture Decision Records
```

## Common commands

```bash
# Install dependencies
pnpm install

# Serve backend (port 3000)
pnpm nx serve backend

# Serve frontend (port 4200)
pnpm nx serve web

# Build all
pnpm nx run-many -t build

# Test all
pnpm nx run-many -t test

# Lint all
pnpm nx run-many -t lint

# Run affected only (faster in CI)
pnpm nx affected -t build
pnpm nx affected -t test
```

## Key conventions

- **DB adapter** is selected by the `DB_PROVIDER` env var: `mongo` (default, local) or `firestore` (GCP prod).
- **Environment files**: backend reads `.env.development` at the workspace root; copy `.env.production.example` as reference.
- **ADRs**: record significant architecture decisions in `docs/adr/` using `YYYY-MM-DD-<slug>.md` naming.

## Instructions

- **Code coverage** any changes to backend is covered by tests.
- **ADRs** every significant change is documented in an ADR. Ask if unclear whether the change is big enough to warrant an ADR.

## Local environment variables (`.env.development`)

See README.md

## Debugging

- Backend: use the **"Debug backend with Nx"** launch config in VS Code (`.vscode/launch.json`).
- Frontend: standard Angular source maps in Chrome DevTools; source files are under `apps/web/src/`.
