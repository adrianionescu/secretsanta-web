# ADR — Client-Side Session Import / Export

**Date:** 2026-03-28
**Status:** Accepted

---

## Context

Users needed a way to back up session data and restore it across environments (e.g. from local dev to production, or as a manual backup before wiping the database). The data being exported is simple and human-readable — session name, date, participants, and pairs.

## Decision

Implement export and import entirely on the frontend (`SessionListComponent`), with no new backend endpoints.

- **Export (single session):** serialises the session to a plain-text `.txt` file and triggers a browser download via a temporary object URL.
- **Export (all sessions):** same format, sessions separated by `\n---\n`, downloaded as `sessions.txt`.
- **Import:** user selects a `.txt` file; the frontend parses it back into session objects and calls the existing `POST /sessions` endpoint sequentially for each one.

The plain-text format is intentional — it is human-readable and editable without tooling.

## Consequences

- No backend changes required; the existing save endpoint is reused for import.
- The import/export format is a custom plain-text schema (`Session:`, `Date:`, `Participants:`, `Pairs:` labels). It is not JSON or CSV, so external tooling cannot consume it without a custom parser.
- Import is sequential (one request per session) rather than batched — acceptable for the small data volumes expected.
- Partial imports are possible if some sessions fail (e.g. name conflict); errors are surfaced inline but already-imported sessions are not rolled back.
