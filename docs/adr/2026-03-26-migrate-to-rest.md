# ADR — Migrate Backend Communication from ConnectRPC to REST

**Date:** 2026-03-26
**Status:** Accepted

---

## Context

The initial architecture (ADR § 2) used ConnectRPC v2 (`@connectrpc/connect-node` as NestJS middleware, `@connectrpc/connect-web` on the Angular client) to satisfy the original requirement for gRPC-based communication without an Envoy proxy.

During local development it was discovered that `connectNodeAdapter` v2 does not integrate cleanly with NestJS's middleware chain: the adapter returned HTTP 404 for every request instead of forwarding unmatched requests to NestJS route handlers. The health endpoint (`/health`) was also silently swallowed by the ConnectRPC middleware before NestJS could respond to it.

Debugging the NestJS middleware integration would have required forking or patching the ConnectRPC adapter. Given that the application is a simple CRUD API with four endpoints, the complexity of the ConnectRPC/proto toolchain (Buf CLI, `proto:gen` task, generated `libs/proto`, version-locked `@bufbuild/protobuf` packages) significantly outweighed any benefit for this use case.

---

## Decision

Replace all ConnectRPC/gRPC communication with plain REST (HTTP/JSON):

- **Backend**: NestJS `@Controller` / `@Get` / `@Post` decorators on a new `SessionController`. The ConnectRPC middleware, `session-connect.handler.ts`, and the entire `libs/proto` library are deleted.
- **Frontend**: Angular `HttpClient` replaces `createClient` + `createConnectTransport`. The `Session` type imported from `@secret-santa/proto` is replaced by `SessionModel` from `@secret-santa/shared`.
- **Shared types**: `libs/shared` (which already defined `SessionModel`, `Pair`, and `ISessionRepository`) becomes the sole source of cross-boundary types; no generated code is needed.
- **Tooling removed**: `@connectrpc/connect`, `@connectrpc/connect-node`, `@connectrpc/connect-web`, `@bufbuild/protobuf`, `@bufbuild/buf`, `@bufbuild/protoc-gen-es`, `protobufjs`; the `proto/` directory; `buf.yaml`; `buf.gen.yaml`; the `proto:proto-gen` Nx target.

### REST endpoint mapping

| Old ConnectRPC method          | New REST endpoint                     |
|-------------------------------|---------------------------------------|
| `ListSessions`                | `GET  /sessions`                      |
| `GetLatestSession`            | `GET  /sessions/latest`               |
| `GeneratePairs`               | `POST /sessions/generate-pairs`       |
| `SaveSession`                 | `POST /sessions`                      |

---

## Alternatives Considered

- **Debug the ConnectRPC NestJS middleware integration** — the v2 adapter API differs from v1 in ways that make it incompatible with NestJS's `NestMiddleware` contract. A fix would require maintaining a local patch or waiting for upstream support.
- **Use a standalone HTTP server alongside NestJS** — running a second HTTP listener to host the ConnectRPC adapter would add operational complexity and split the request-handling surface.
- **Switch to gRPC-Web + Envoy proxy** — more operationally complex, contradicts the original rationale for choosing ConnectRPC (no proxy required).

---

## Rationale

The application has four simple endpoints over one resource (`sessions`). REST/JSON is the lowest-complexity choice: no schema compilation step, no generated client stubs, no version-locked binary tooling, and first-class NestJS + Angular `HttpClient` support. Removing the proto toolchain shortens the contributor setup path and eliminates an entire category of build failures.

---

## Consequences

- The API no longer uses protobuf wire format; all payloads are JSON.
- `libs/proto` and all generated code are gone; re-adding gRPC would require re-introducing the Buf toolchain.
- `libs/shared` is the canonical location for types shared between frontend and backend. Adding a field to the API requires updating `SessionModel` (or a new interface) in `libs/shared` and both the controller and the Angular service — no proto file or `buf generate` run needed.
- The `proto:gen` step is removed from the developer setup; `pnpm install` is now sufficient.
- Existing ADR § 2 (ConnectRPC decision) is superseded by this ADR and retained as a historical record.
