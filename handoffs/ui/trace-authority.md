# Trace authority UI handoff

Outcome:
The public booking row starts immediately from a minimal local browser presentation event, then replaces that row with the runtime-validated, session-bound sanitized snapshot returned by `GET /api/traces`. Only `book_appointment` is presented, under the fixed friendly label `Book appointment`. The App no longer manufactures a completed booking trace from workflow state. A missing or ambiguous terminal response remains `reconciling` rather than claiming failure or success.

Owned files changed:
- `src/app/App.tsx`
- `tests/e2e/trace-authority.spec.ts`
- `handoffs/ui/trace-authority.md`

RED command:
`npx playwright test tests/e2e/trace-authority.spec.ts`

Expected failing assertion:
After the booking request completes, the expanded row must show the server snapshot's allowlisted `appointmentDisplay`, not the previous client-authored `Appointment recorded` output.

Observed RED result:
The running and completed row states rendered, but `Tuesday, August 4 at 10:30 AM` was absent because App never read `/api/traces`.

GREEN commands and results:
- `npx playwright test tests/e2e/trace-authority.spec.ts` — 1 passed.
- `npm run test:e2e` — 8 passed after root integration.
- `npx eslint src/app/App.tsx tests/e2e/trace-authority.spec.ts` — PASS.

Refactor performed:
Terminal trace conversion is isolated in `presentBookingTraces`. It validates the HTTP response with the frozen `TracePresentationSchema`, ignores tools outside the public booking allowlist, computes duration from safe timestamps, and adds only the fixed friendly display name and workflow-derived provider mode.

Manual verification:
The integrated browser flow displayed the local running row, replaced it with the server-supplied completed row, retained it after reload, and kept an unrelated public session's trace snapshot empty.

Remaining risks:
- Trace state is intentionally process-memory presentation state and can be rebuilt from workflow evidence; it is not durable workflow truth or an audit log.
- The App intentionally supplies no session, role, persona, trace ID, or subject selector. The server scopes snapshots only from the current role-bound cookie session.

Requested contract change:
None. App consumes the existing strict trace presentation schema.
