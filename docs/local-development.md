# Local Development

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 24.x | [nodejs.org](https://nodejs.org) |
| pnpm | 10.32.x | `npm install -g pnpm` |
| Docker + Docker Compose | latest | [docker.com](https://docker.com) |
| MongoDB | via Docker | see below |

> If you're using the **dev container** (recommended), all prerequisites are already installed.

---

## First-Time Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start MongoDB

The dev container starts MongoDB automatically via Docker Compose. If you're running outside the dev container, see README.md for details.

---

## Running the Application

Open two terminals and run the backend and frontend in parallel.

### Backend (Backend — port 3000)

```bash
pnpm run dev:backend
```

The Backend starts on `http://localhost:3000`. Test it is running:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

### Frontend (port 4200)

```bash
pnpm run dev:web
```

Open `http://localhost:4200` in your browser. The Angular dev server proxies nothing — it calls the Backend at `http://localhost:3000` directly.

---

## Environment Variables

The Backend reads its configuration from a `.env.development` file at the workspace root. See README.md for details.

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific project
pnpm nx test backend
pnpm nx test web

# Run tests in watch mode
pnpm nx test backend --watch
```

---

## Linting

```bash
# Lint all projects
pnpm lint

# Lint a specific project
pnpm nx lint backend
pnpm nx lint web
```

---

## Building for Production

```bash
# Build all
pnpm build

# Build individually
pnpm nx build backend
pnpm nx build web
```

Output goes to `dist/apps/backend/` and `dist/apps/web/`.

---

## Debugging

### Backend (NestJS) in VS Code

A launch configuration is provided in `.vscode/launch.json`. In VS Code:

1. Press `F5` or open the **Run and Debug** panel
2. Select **"Debug backend with Nx"**
3. The Backend starts with `--inspect`, and VS Code attaches automatically

You can set breakpoints in any file under `apps/backend/src/`.

Alternatively, start the Backend in debug mode from the terminal:

```bash
node --inspect -r ts-node/register -r tsconfig-paths/register apps/backend/src/main.ts
```

Then attach a debugger to port `9229`.

### Frontend (Angular) in VS Code

Angular runs in the browser, so debugging happens in **Chrome DevTools** or via the VS Code browser debugger:

1. Start the frontend: `pnpm nx serve web`
2. Open Chrome DevTools (`F12`) → **Sources** tab
3. Source maps are enabled in development — you can set breakpoints directly in TypeScript files

Or use the VS Code **"Debug Web"** launch configuration (attaches to Chrome on port 4200).

### Inspecting REST API calls

API calls can be inspected in Chrome DevTools → **Network** tab → filter by `Fetch/XHR`. The REST endpoints are:

- `GET  /sessions` — list all sessions
- `GET  /sessions/latest` — get the most recent session
- `POST /sessions/generate-pairs` — generate pairs (not saved)
- `POST /sessions` — save a session

---

## Nx Useful Commands

```bash
# Show dependency graph
pnpm nx graph

# Show details about a project
pnpm nx show project backend
pnpm nx show project web

# Run any Nx target
pnpm nx run <project>:<target>

# Run affected projects only (faster in CI)
pnpm nx affected -t build
pnpm nx affected -t test
```

---

## Project Structure Quick Reference

```
apps/backend/src/
  session/session.service.ts     ← pair generation & business logic
  session/session.controller.ts  ← REST API endpoints
  repository/                    ← MongoDB and Firestore adapters

apps/web/src/app/
  services/session.service.ts                        ← REST client (HttpClient)
  components/session-form/session-form.component.ts  ← top UX section
  components/session-list/session-list.component.ts  ← bottom UX section

libs/shared/src/lib/               ← ISessionRepository, SessionModel, Pair
```
