# ADR — Initial Architecture Decisions

**Date:** 2026-03-22
**Status:** Accepted

---

## Context

The Secret Santa application was greenfield. A number of foundational decisions were made simultaneously when implementing the requirements in `docs/requirements.txt`. This ADR records those decisions together because they were made as a single coherent set rather than independently over time.

---

## Decisions

### 1. Nx monorepo + pnpm workspaces

**Decision:** Organise the project as a single Nx (v22.6) monorepo managed by pnpm workspaces, with `apps/backend`, `apps/web`, `libs/proto`, and `libs/shared` as first-class projects.

**Alternatives considered:**
- Separate Git repositories for frontend and backend.
- A single-package repo with subdirectories.

**Rationale:** The frontend and backend share generated proto types and the `ISessionRepository` interface. A monorepo with Nx allows a single `proto-gen` task to produce types that are immediately available to both apps without publishing a package. Nx's affected-task detection also speeds up CI by only running tests/builds for projects touched by a given PR.

**Consequences:** All contributors clone one repository. Nx and pnpm must be installed (or the dev container used). The Nx dependency graph must be kept accurate as new projects are added.

---

### 2. ConnectRPC v2 instead of standard gRPC-Web + Envoy

**Decision:** Use `@connectrpc/connect-node` as an Express-compatible NestJS middleware on the server and `@connectrpc/connect-web` on the Angular client. No Envoy (or any other) proxy is deployed.

**Alternatives considered:**
- Native gRPC (`@grpc/grpc-js`) — requires a proxy layer between the browser and server.
- gRPC-Web with an Envoy sidecar on Cloud Run.
- Plain REST/JSON.

**Rationale:** Browsers cannot initiate native gRPC connections (HTTP/2 binary framing is hidden from Fetch/XHR). The classic fix is an Envoy sidecar that translates gRPC-Web → gRPC. ConnectRPC implements its own framing over standard HTTP/1.1 POST, so the NestJS server can receive calls directly from the browser — eliminating the proxy and its operational overhead. The requirements specified gRPC, and ConnectRPC is the lowest-friction way to meet that requirement without additional infrastructure.

**Consequences:** The server speaks ConnectRPC framing, not vanilla gRPC. Non-browser gRPC clients (e.g. `grpcurl`) cannot call the endpoints without using ConnectRPC's gRPC-compatible mode. ConnectRPC and `@bufbuild/protobuf` versions must stay in sync.

---

### 3. Repository pattern: `ISessionRepository` with MongoDB (local) and Firestore (GCP)

**Decision:** Define `ISessionRepository` in `libs/shared` as the single port interface. `RepositoryModule.forRoot()` reads `DB_PROVIDER` at startup and injects either `MongoSessionRepository` or `FirestoreSessionRepository`. All business logic depends only on the interface.

**Alternatives considered:**
- Use Firestore in both environments (needs GCP emulator locally).
- Use a single ORM that targets both databases.

**Rationale:** MongoDB is the standard local-dev choice for document stores and requires no cloud account. Firestore is the natural fit for GCP production (serverless, no connection management). Keeping both behind a single interface means the business logic and tests never see which DB is active, and swapping is a one-line env-var change.

**Consequences:** Two separate repository implementations must be kept functionally equivalent. Adding a new query means updating the interface and both adapters. Local tests run against MongoDB; production runs against Firestore — integration tests must cover both paths.

---

### 4. Buf CLI installed as an npm devDependency

**Decision:** Add `@bufbuild/buf` as a workspace devDependency and invoke it via `node_modules/.bin/buf generate` inside the `proto:proto-gen` Nx target.

**Alternatives considered:**
- Install `buf` as a system binary via the OS package manager or a Dockerfile step.
- Check generated files into git and skip running buf in CI.

**Rationale:** A system-level `buf` install requires additional CI setup steps and is environment-dependent. The npm package pins the exact buf version alongside all other dependencies in `pnpm-lock.yaml`, so every developer and CI run uses the same binary without any extra setup.

**Consequences:** `buf` is only accessible through `node_modules/.bin/buf`; running it directly requires the full path or `pnpm exec buf`. Generated files in `libs/proto/src/gen/` are gitignored and must be produced via `pnpm nx run proto:proto-gen` after cloning.

---

### 5. Workload Identity Federation for GCP CI/CD authentication

**Decision:** GitHub Actions authenticates to GCP using Workload Identity Federation (WIF) instead of a long-lived service account key stored as a GitHub secret.

**Alternatives considered:**
- Export a service account JSON key and store it in GitHub Secrets.

**Rationale:** Long-lived keys are a persistent credential that can be leaked or forgotten. WIF issues short-lived tokens bound to a specific GitHub repository and workflow run, eliminating the risk of a leaked key giving long-term access. It is the approach recommended by Google and requires no key rotation.

**Consequences:** One-time setup is more involved (creating a WIF pool and provider, configuring attribute conditions). The `WIF_PROVIDER` and `GCP_SA_EMAIL` secrets in the repository must be set before the first deployment. The setup is documented in `docs/gcp-deployment.md`.

---

### 6. Backend URL injected at Docker build time via `ARG` + `sed`

**Decision:** The Angular production environment file (`environment.prod.ts`) contains the placeholder `__BACKEND_URL__`. The web Dockerfile accepts `BACKEND_URL` as a build argument and uses `sed` to replace the placeholder before running `nx build web`.

**Alternatives considered:**
- Serve a `config.json` at runtime and fetch it from the Angular app on startup.
- Use Cloud Run environment variables and a startup script to patch `index.html`.

**Rationale:** Angular compiles environment values into the bundle at build time. Runtime config injection requires either a server-side render step or a custom fetch-on-init pattern. The `sed` approach is minimal: no extra runtime logic, no config endpoint to maintain. The Cloud Run deploy step already has the Backend URL available as a shell variable, so passing it as a Docker build argument is straightforward.

**Consequences:** Each deployment produces a Docker image that is hard-coded to a specific Backend URL. If the Backend Cloud Run URL ever changes, the web image must be rebuilt. Images are not portable across environments without rebuilding.

---

### 7. Fisher-Yates derangement for pair generation

**Decision:** Pairs are generated by applying a Fisher-Yates shuffle to the receiver list and retrying (up to 100 attempts) until the result is a valid derangement: no participant is paired with themselves, and no pair duplicates a pair from the most recent saved session.

**Alternatives considered:**
- Sattolo cycle (guaranteed derangement in a single pass, but produces a single cyclic permutation rather than a uniformly random derangement).
- Recursive backtracking.

**Rationale:** For the group sizes typical of a Secret Santa (4–30 people), 100 retry attempts is more than sufficient — the probability of a random permutation being a derangement is approximately `1/e ≈ 36.8%`. Fisher-Yates is simple, well-understood, and produces a uniformly random permutation. The retry loop is the simplest correct implementation that avoids the single-cycle constraint of Sattolo.

**Consequences:** In the pathological case (e.g. two participants with a previous pair constraint that makes a valid assignment impossible) the algorithm throws after 100 attempts rather than hanging. The 100-attempt limit is an arbitrary constant in `session.service.ts` and can be raised if needed.
