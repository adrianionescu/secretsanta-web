# Local Development

## Option A — Dev container (recommended)

**Prerequisites:** Docker, VS Code with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension.

1. Open the repository folder in VS Code.
2. When prompted, click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
3. VS Code builds the container image and starts MongoDB automatically — no extra setup needed.
4. Inside the container terminal, install dependencies:
   ```bash
   pnpm install
   ```
5. Start the services in separate terminals:
   ```bash
   pnpm run dev:backend   # http://localhost:3000
   pnpm run dev:web       # http://localhost:4200
   ```

MongoDB is reachable at `mongodb://db:27017` from inside the container.

---

## Option B — Local machine (without dev container)

**Prerequisites:** Node.js 24.x, pnpm 10.x, Docker (for MongoDB).

### 1. Start MongoDB

```bash
docker compose -f .devcontainer/docker-compose.yml -f .devcontainer/docker-compose.override.yml up db -d
```

MongoDB will be available at `mongodb://localhost:27017`.

### 2. Create `.env.development`

Create this file at the workspace root:

```env
PORT=3000
DB_PROVIDER=mongo
# when running in devcontainers
# MONGO_URI=mongodb://db:27017/secretsanta
# when running directly on local machine
MONGO_URI=mongodb://localhost:27017/secretsanta
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Start the services

Open two terminals and run the backend and frontend in parallel:

```bash
pnpm run dev:backend   # http://localhost:3000
pnpm run dev:web       # http://localhost:4200
```

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
