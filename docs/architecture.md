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
| `POST` | `/sessions` | Persist a session (`{ name, participants, pairs }`) |

### `SessionModel` (defined in `libs/shared`)

```
SessionModel {
  name:         string    // unique identifier
  createdAt:    string    // ISO-8601 UTC timestamp
  pairs:        string    // JSON-encoded: [{"giver":"Alice","receiver":"Bob"}, ...]
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

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| [ci.yml](../.github/workflows/ci.yml) | Pull Request → `main` | Lint, test, build (Nx affected) |
| [deploy.yml](../.github/workflows/deploy.yml) | Push to `main` | Build Docker images, push to Artifact Registry, deploy to Cloud Run |
