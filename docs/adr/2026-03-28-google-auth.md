# ADR — Authentication via Google OAuth2 with Static Email Allowlist

**Date:** 2026-03-28
**Status:** Accepted

---

## Context

The app manages Secret Santa sessions and their pair assignments. Without authentication, anyone with the URL could read, create, or delete sessions. The user base is a small, known group — there is no need for self-registration or role management.

## Decision

Authenticate users via **Google Sign-In** (OAuth2 ID token flow) with access controlled by a **static allowlist of email addresses** stored in a plain-text file on the backend.

**Flow:**
1. The Angular frontend loads the Google Identity Services (GSI) script and renders a "Sign in with Google" button.
2. On sign-in, GSI returns a Google-issued ID token (JWT) directly in the browser — no redirect.
3. The frontend posts the ID token to `POST /auth/google`.
4. The backend verifies the token's signature and audience using `google-auth-library`, then checks the email against `apps/backend/allowed-emails.txt`.
5. If allowed, the backend issues a short-lived application JWT (`@nestjs/jwt`, 8 h expiry) signed with `JWT_SECRET`.
6. The frontend stores the JWT in `sessionStorage` and attaches it as a `Bearer` token on all subsequent requests via an Angular HTTP interceptor.
7. All `/sessions` endpoints are protected by `JwtAuthGuard`.

**Allowlist file** (`apps/backend/allowed-emails.txt`):
- One email per line; lines starting with `#` are ignored.
- Baked into the Docker image at build time — changing the list requires a redeploy.
- Path configurable via `ALLOWED_EMAILS_PATH` env var (defaults to `allowed-emails.txt` next to the running process).

## Alternatives considered

- **Firebase Authentication / Google Cloud Identity Platform** — avoids managing tokens manually but adds a significant GCP dependency, cost surface, and setup overhead for a small closed group.
- **HTTP Basic Auth / shared password** — simpler to implement but offers no per-user identity and credentials are easy to share accidentally.
- **No authentication** — not acceptable; sessions contain personal pair assignments.

## Consequences

- Adding or removing users requires editing `allowed-emails.txt` and redeploying the backend image.
- The allowlist is visible in the Docker image and source repository — it should only contain non-sensitive identifiers (email addresses).
- JWTs expire after 8 hours; users must sign in again per browser session (`sessionStorage` is cleared on tab close).
- `GOOGLE_CLIENT_ID` and `JWT_SECRET` must be added as GitHub secrets and to `.env.development` locally — see `docs/gcp-deployment.md` and `docs/local-development.md`.
- A Google Cloud OAuth2 client must be created in the GCP project with the app's origin added as an authorised JavaScript origin (no redirect URIs needed for the ID token flow).
