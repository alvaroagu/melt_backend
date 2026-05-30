# User authentication design

## Context

Melt currently exposes business modules in the NestJS backend and renders the Next frontend as an already-authenticated application. There is an existing `users` module in the backend, but it only provides CRUD behavior and does not handle authentication, authorization, or session lifecycle.

This design adds the first authenticated access layer for Melt with these validated constraints:

- Access starts directly at a login screen.
- Users do not self-register.
- Accounts are created manually by an administrator.
- The first version supports two roles: `ADMIN` and `USER`.
- Authentication is implemented in-house with JWT access tokens plus refresh tokens stored in secure HTTP-only cookies.
- Password recovery and social login are out of scope for this version.

## Goals

- Require authentication before entering the application.
- Support role-aware access for `ADMIN` and `USER`.
- Keep the design compatible with the current NestJS + Prisma backend and Next frontend.
- Preserve a clear separation between user management and authentication/session logic.
- Establish a base that can later grow into password reset, audit history, or stricter session controls.

## Non-goals

- Open user registration.
- Social login providers.
- Password recovery flow.
- Fine-grained permissions beyond the two initial roles.
- SSO or third-party identity providers.

## Recommended approach

Use a dedicated `auth` module in the backend and keep `users` focused on user data and admin-managed account lifecycle.

The backend issues:

- a short-lived access token for authenticated requests
- a longer-lived refresh token for session renewal

Both tokens are delivered through secure HTTP-only cookies so the frontend does not need to store secrets in local storage. The refresh token is rotated on use and only its hash is persisted server-side.

The frontend treats the application as private by default. Unauthenticated access is redirected to `/login`, and the current session is resolved through an authenticated endpoint such as `GET /auth/me`.

## Architecture

### Backend boundaries

`users` remains the owner of user records and admin-driven account management. `auth` becomes the owner of:

- credential validation
- password hashing and comparison
- token generation
- refresh token rotation
- logout and session invalidation
- current-session lookup
- guards for authenticated and role-protected routes

This split avoids overloading the existing users CRUD module with session concerns and keeps future security changes isolated.

### Frontend boundaries

The frontend adds:

- a public `/login` page
- a central session retrieval layer
- route protection for private screens
- logout handling
- role-aware UI gating where needed

The backend remains the source of truth for authorization. Any admin-only restriction visible in the UI must also be enforced in backend guards.

## Data model changes

The `User` model should include, at minimum:

- `email` as a unique identifier
- `passwordHash`
- `role` enum with values `ADMIN` and `USER`
- `isActive`
- standard timestamps

To support refresh rotation without storing raw tokens, add one of these persistence patterns:

1. A small session table keyed by user and device/session identifier, storing a hashed refresh token and expiry.
2. A single hashed refresh token field on the user record if only one active session per user is acceptable.

For this first version, the preferred option is a session table because it avoids painting the product into a corner if concurrent sessions or audit visibility become necessary soon after rollout.

## API design

Add an `auth` module with endpoints similar to:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Behavior:

- `POST /auth/login` validates email and password, checks that the user is active, sets access and refresh cookies, and returns a sanitized user payload.
- `POST /auth/refresh` validates the refresh token, rotates it, reissues cookies, and returns the current sanitized user payload if needed.
- `POST /auth/logout` clears cookies and invalidates the persisted refresh token/session.
- `GET /auth/me` returns the authenticated user context needed by the frontend, including role.

Existing business endpoints should adopt an authentication guard by default unless a route is explicitly public. Admin-only capabilities should additionally use a role guard.

## Frontend design

### Login experience

The first screen for unauthenticated users is `/login`, containing:

- email field
- password field
- submit button
- inline validation
- visible error state for invalid credentials

Successful login redirects to `/dashboard` or the originally requested private route if one was intercepted.

### Session handling

The app should no longer assume that `app/page.tsx` can always redirect to `/dashboard`. Instead, the application shell needs an authentication check before rendering private routes. The frontend should:

- request session state from `GET /auth/me`
- redirect unauthenticated users to `/login`
- allow authenticated users into private routes
- clear local session state on logout
- rely on cookie-based auth rather than storing tokens in browser-managed application state

### Role-aware UI

Role handling should stay minimal in the UI:

- `ADMIN` users can access account-management actions and any admin-only configuration screens
- `USER` users can access the normal operational screens allowed by backend policy

The UI may hide or disable admin-only navigation and actions, but it must never be the sole access control layer.

## Core flows

### Login

1. User opens a private route or the app root.
2. If no valid session exists, frontend redirects to `/login`.
3. User submits email and password.
4. Backend validates the account, sets cookies, and returns sanitized user data.
5. Frontend redirects to the dashboard or intended destination.

### Session renewal

1. Access token expires.
2. Frontend request flow triggers refresh through the backend.
3. Backend validates the refresh token hash, rotates it, and sets new cookies.
4. Original request continues with a valid session.
5. If refresh fails, frontend returns the user to `/login`.

### Logout

1. User clicks logout.
2. Frontend calls `POST /auth/logout`.
3. Backend invalidates the persisted session/refresh token and clears cookies.
4. Frontend redirects to `/login`.

## Error handling

The system should expose clear but controlled errors:

- Invalid email/password returns a generic authentication error.
- Inactive users receive a specific denial that explains the account is disabled.
- Invalid or expired refresh tokens terminate the session and force a login redirect.
- Logout clears cookies even if the backend session is already missing, so the client is left in a consistent state.

The frontend should surface login errors inline on the form and avoid leaving the user in a partially authenticated state.

## Security decisions

- Passwords are stored only as strong hashes.
- Tokens are sent in secure HTTP-only cookies.
- Refresh tokens are rotated and persisted as hashes, never in plain text.
- Authorization is enforced in backend guards, not only in the frontend.
- User payloads returned to the frontend exclude password and token data.
- Inactive accounts cannot authenticate or refresh sessions.

## Testing strategy

### Backend

Cover:

- successful login
- rejected login with incorrect password
- rejected login for inactive users
- successful refresh
- rejected refresh for invalid or expired tokens
- successful logout
- authentication guard on protected routes
- role guard on admin-only routes

### Frontend

Cover:

- unauthenticated redirect to `/login`
- login form validation and visible errors
- redirect after successful login
- logout redirect behavior
- blocked access to private pages when no session exists
- admin-only UI gating where applicable

## Delivery notes

This scope is intentionally limited to first-party login for internally managed accounts. That keeps the initial implementation focused and reduces risk while still introducing the key building blocks needed for a production-worthy authenticated application.

Future extensions can layer on top of this design without changing the core boundary decisions:

- password reset
- invite-based onboarding
- account audit history
- finer-grained permissions
- multi-session management UI
