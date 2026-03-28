# Architecture

## Overview

Secret Santa is a full-stack web application organized as a **monorepo** using [Nx](https://nx.dev) and [pnpm workspaces](https://pnpm.io/workspaces). The backend and frontend are independent deployable services that communicate over **REST**.

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│                                                     │
│   Angular 21 SPA  ──── REST (HttpClient) ────────► │
└──────────────────────────────────┬──────────────────┘
                                   │ HTTP
                                   ▼
                    ┌──────────────────────────┐
                    │   NestJS 11 (Backend)        │
                    │                          │
                    │  SessionController       │
                    │  └── SessionService      │
                    │       └── ISessionRepo   │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │                          │
               (local dev)                 (GCP prod)
            MongoDB (Mongoose)         Cloud Firestore
```

---

## Repository Structure

```
secret-santa-web/
├── apps/
│   ├── backend/       # NestJS backend
│   └── web/           # Angular frontend
├── libs/
│   └── shared/        # Shared interfaces (ISessionRepository, models)
└── .github/workflows/ # CI/CD pipelines
```

---

## Tech Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Monorepo | [Nx](https://nx.dev) | 22.6 | Build system, task orchestration, caching |
| Package manager | [pnpm](https://pnpm.io) | 10.32 | Workspace dependency management |
| **Frontend** | [Angular](https://angular.dev) | 21 | SPA framework (standalone components) |
| **Backend** | [NestJS](https://nestjs.com) | 11 | Node.js server framework |
| **Backend protocol** | REST (HTTP/JSON) | — | Standard HTTP endpoints |
| DB (local) | [MongoDB](https://mongodb.com) + Mongoose | 9.x | Local development database |
| DB (GCP) | [Cloud Firestore](https://cloud.google.com/firestore) | 8.x | Production database |
| Language | TypeScript | 5.7 | Both frontend and backend |

---

## Backend Design

### Endpoints: `SessionController` (`/sessions`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/sessions` | All sessions, newest first |
| `GET` | `/sessions/latest` | Most recent session (`{ session, found }`) |
| `POST` | `/sessions/generate-pairs` | Generate pairs without saving (`{ participants }`) |
| `POST` | `/sessions` | Persist a session (`{ name, participants, pairs, createdAt? }`) |
| `DELETE` | `/sessions/:name` | Delete a session by name |
| `DELETE` | `/sessions` | Delete all sessions |

### `SessionModel` (defined in `libs/shared`)

```
SessionModel {
  name:         string    // unique identifier
  createdAt:    string    // ISO-8601 UTC timestamp
  pairs:        string    // JSON-encoded: [{"giver":"Alice","giverId":"1","receiver":"Bob","receiverId":"2"}, ...]
  participants: string[]
}
```

---

## Backend (`apps/backend`)

```
src/
├── main.ts                         # Bootstrap, CORS config
├── app/
│   ├── app.module.ts               # Root module
│   └── app.controller.ts           # GET /health
├── session/
│   ├── session.module.ts
│   ├── session.controller.ts       # REST endpoints
│   └── session.service.ts          # Business logic, pair generation
└── repository/
    ├── repository.module.ts        # Dynamic module: selects DB adapter
    ├── mongo/
    │   ├── session.schema.ts       # Mongoose schema
    │   └── mongo-session.repository.ts
    └── firestore/
        └── firestore-session.repository.ts
```

### Repository Pattern

`ISessionRepository` (defined in `libs/shared`) is the port interface. The correct adapter is injected at startup based on the `DB_PROVIDER` environment variable:

```
DB_PROVIDER=mongo      → MongoSessionRepository  (default, local dev)
DB_PROVIDER=firestore  → FirestoreSessionRepository  (GCP production)
```

### Pair Generation Algorithm

Pairs are generated using a **Fisher-Yates shuffle** applied to the receiver list. The algorithm retries up to 100 times until it produces a valid assignment where:
- No participant is paired with themselves
- No `(giver → receiver)` pair matches any pair from the previous session

---

## Frontend (`apps/web`)

```
src/app/
├── app.ts                          # Root component
├── app.config.ts                   # Angular providers (provideHttpClient)
├── components/
│   ├── session-form/               # Top section: manage participants, generate & save
│   └── session-list/               # Bottom section: display all saved sessions
└── services/
    └── session.service.ts          # REST client (HttpClient, returns RxJS Observables)
```

---

## Configuration & Environment Variables

### Backend (`apps/backend`)

Backend configuration is read exclusively from environment variables via `process.env`. In local development these come from `.env.development` at the workspace root (loaded by NestJS `ConfigModule`). In production they are injected by Cloud Run at deploy time via the GitHub Actions workflow.

| Variable | Required | Default | Where it's set | Description |
|---|---|---|---|---|
| `DB_PROVIDER` | Yes | `mongo` | `.env.development` / Cloud Run env (see `deploy_gcp.yml`) | Selects the DB adapter: `mongo` (local) or `firestore` (GCP prod) |
| `MONGO_URI` | When `DB_PROVIDER=mongo` | `mongodb://localhost:27017/secretsanta` | `.env.development` | MongoDB connection string; only used when `DB_PROVIDER=mongo` |
| `GCP_PROJECT_ID` | When `DB_PROVIDER=firestore` | — | Cloud Run env (from `GCP_PROJECT_ID` GitHub secret,  see `deploy_gcp.yml`) | GCP project ID passed to the Firestore client |
| `PORT` | No | `3000` | Cloud Run env (set automatically by Cloud Run) | HTTP port the backend listens on |

**How `DB_PROVIDER` controls the adapter** (`repository.module.ts`):
```
DB_PROVIDER=mongo      → MongoSessionRepository   (default, used locally)
DB_PROVIDER=firestore  → FirestoreSessionRepository (used on GCP)
```

---

### Frontend (`apps/web`)

The frontend has no runtime environment variables. Configuration is baked in at **build time** via Angular environment files:

| File | Used when | `backendUrl` value |
|---|---|---|
| `src/environments/environment.ts` | Local dev (`ng serve`) | `http://localhost:3000` (hardcoded) |
| `src/environments/environment.prod.ts` | Production build | `__BACKEND_URL__` placeholder, replaced by `sed` in the Dockerfile before `nx build` |

**How `BACKEND_URL` flows into a production image:**

1. The GitHub Actions workflow captures the Cloud Run URL output from the backend deploy step.
2. The web `Dockerfile` receives it as a build arg (`ARG BACKEND_URL`).
3. A `sed` command replaces the `__BACKEND_URL__` placeholder in `environment.prod.ts` before the Angular build runs.

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| [ci.yml](../.github/workflows/ci.yml) | Pull Request → `main` | Lint, test, build (Nx affected) |
| [deploy_gcp.yml](../.github/workflows/deploy_gcp.yml) | Push to `main` | Build Docker images, push to Artifact Registry, deploy to Cloud Run |
