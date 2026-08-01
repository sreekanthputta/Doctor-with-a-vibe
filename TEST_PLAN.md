# VibeDoc Test-First Implementation Contract

> Normative priority: subordinate to `AGENTS.md`, `HACKATHON.md`, `CLINIC.md`, and `ARCHITECTURE.md`; paired with `BUILD_PLAN.md`. Tests do not expand product scope.

## TDD invariant

Every behavioral task follows:

```text
write one meaningful test
  -> run and record expected RED
  -> implement the smallest behavior
  -> run and record GREEN
  -> refactor while green
  -> run the lane merge gate
```

A missing module may be the initial scaffold RED. After the public module exists, RED must fail the intended behavioral assertion—not syntax, import resolution, configuration, a provider outage, or an unrelated suite. Never delete, skip, weaken, snapshot-update, or broaden a mock merely to make a test pass.

Intentional red states live only in isolated writer worktrees. Only green commits may be handed to or merged by the root integrator.

## Tooling freeze

Gate 0 installs and locks:

- strict TypeScript;
- Vitest for schema, unit, adapter-contract, integration, and React component tests;
- React Testing Library and `user-event` for accessible UI behavior;
- Playwright for the critical four-shell browser path;
- ESLint and the repository formatter chosen by the integrator;
- one production build/start path identical to Railway.

Normal tests require no live Medplum, Deepgram, Stedi, or Railway account. Optional live conformance tests use explicit environment gates and never replace fixture suites.

## Immutable demo fixture

All lanes import one root-owned `DEMO_V1` fixture rather than creating local copies:

```text
clock: 2026-08-01T15:00:00-05:00
timezone: America/Chicago
identifier system: urn:vibedoc:demo
identifier value prefix: demo-v1:
physician: Dr. Maya Chen
patient persona: maria-demo
normalized identity: Maria | Lopez | 1974-02-14 | demo postal 60601
visit type: adult-annual-wellness
offered slots: 2026-08-04 09:30 and 10:30 CDT
selected slot: 2026-08-04 10:30 CDT
synthetic member ID: AETNA-DEMO-2048
```

The reset seed contains the practice, payer, physician/role, service, schedule, slots, versioned Questionnaire, published policy, and test configuration. It does **not** contain Maria's `Patient`, appointment, coverage, response, Task, communications, eligibility resources, or Provenance. The public happy path creates that graph with stable business identifiers. Component tests may use derived immutable view-model snapshots representing later stages.

The server derives Maria's business identifier. Client input never contains it. Freeze identity outcomes `verified-new-demo`, `exact-existing-demo`, and `uncertain`. Two simultaneous exact requests converge: one conditional create wins and the loser re-reads the single identifier as `exact-existing-demo`. Near matches, altered DOB/postal code, client-supplied identifiers, retries, and injected multiple-existing-candidate results are explicit fixtures. The first two outcomes target the same server-derived identity; uncertain binds no patient and stores no candidate PHI.

Freeze logical business identifiers for every seeded resource and every app-created resource whose endpoint preserves them, plus workflow run, command idempotency key, provider fixture, and Provenance target. For server-assigned `$book` outputs, never assume identifier propagation or a resource ID: the FHIR live gate records the exact returned Appointment/Slot references and the verified cleanup mechanism before OP-202 proceeds.

## Closed administrative intent corpus

The v1 `AdministrativeIntent` discriminated union contains only:

- automation disclosure acknowledgment;
- voice-processing accept, decline, or revoke;
- minimum synthetic identity submission;
- annual-wellness request with bounded date/time preference;
- offered-slot selection;
- allowed demographics submission;
- allowed coverage submission;
- available intake-answer submission;
- synthetic member-ID submission;
- approved administrative FAQ selection.

Freeze positive examples plus unmatched, misspelled, negated, euphemistic, clinical, and mixed clinical/administrative examples. Anything outside the union fails closed to one atomic stop outcome and one owned `requested` exception command, with no appointment or PHI disclosure.

Every clinical or mixed stop must also return the exact fixed safety copy in `AGENTS.md`. Tests compare the complete string and assert the model cannot paraphrase it. Production use remains gated on licensed-clinician and counsel/privacy review.

## Test pyramid

### Schema and fixture contract tests

Root-owned:

```text
src/contracts/__tests__/
  administrative-intent.test.ts
  commands.test.ts
  eligibility.test.ts
  fhir-identifiers.test.ts
  ready-visit-vm.test.ts
  session.test.ts
  trace.test.ts
  trace-projections.test.ts
  security-event.test.ts
  fixture-conformance.test.ts
```

Every boundary exports a Zod schema and an inferred TypeScript type. Tests accept the canonical fixtures and reject malformed, extra, mixed-authority, prohibited, and provider-native fields.

### Pure domain tests

Lane A owns:

```text
src/domain/__tests__/
  administrative-grammar.test.ts
  identity-gate.test.ts
  practice-policy.test.ts
  workflow-reducer.test.ts
  readiness.test.ts
  exception-policy.test.ts
  task-lifecycle.test.ts
  intake-completeness.test.ts
```

These tests inject clock and ID generation, perform no I/O, and form the largest and fastest test layer.

### FHIR and repository tests

Lane B owns:

```text
src/fhir/__tests__/
  scheduling-mapper.test.ts
  scheduling-repository.contract.test.ts
  questionnaire-response-mapper.test.ts
  eligibility-mapper.test.ts
  task-mapper.test.ts
  communication-mapper.test.ts
  mutation-service.test.ts
  provenance.test.ts
  mutation-reconciliation.test.ts
  seed-reset.test.ts
```

Pure mapper tests validate FHIR R4 shapes. Repository contracts run against the in-memory fixture first and may run against hosted Medplum only when explicitly enabled. Mutation tests cover allowlists, expected versions, idempotency, transaction response validation, version-specific Provenance, and response-loss reconciliation.

### UI component tests

Lane C owns:

```text
src/ui/__tests__/
  public-access-shell.test.tsx
  synthetic-demo-access-shell.test.tsx
  patient-workspace-shell.test.tsx
  physician-cockpit-shell.test.tsx
  ready-visit-rail.test.tsx
  exception-inbox.test.tsx
  function-trace-group.test.tsx
  trace-context-reset.test.tsx
  accessibility.test.tsx
```

UI tests consume frozen view models and callback spies, never raw FHIR resources. Cover loading, empty, stopped, stale, forbidden, retry, fixture/live labels, focus preservation, keyboard controls, ARIA-live trace updates, reduced motion, 44px patient targets, and status cues that do not rely on color.

### Adapter contract tests

The root owns the initial scripted adapters. Freed writers may own non-overlapping provider directories in Wave 2:

```text
src/providers/deepgram/__tests__/conversation-adapter.contract.test.ts
src/providers/stedi/__tests__/eligibility-adapter.contract.test.ts
```

Every implementation must satisfy the same root-owned contract suite as its deterministic fixture. Provider-specific objects never cross the adapter boundary.

### Server and integration tests

Root-owned:

```text
tests/integration/
  ready-visit-flow.test.ts
  uncertain-identity.test.ts
  slot-conflict.test.ts
  provider-outage.test.ts
  role-session-matrix.test.ts
  voice-consent-token.test.ts
  trace-stream.test.ts
  trace-redaction.test.ts
  mutation-response-loss.test.ts
  graceful-shutdown.test.ts
  health.test.ts
  browser-secret-scan.test.ts
```

### Browser tests

Root-owned:

```text
tests/e2e/
  ready-visit.spec.ts
  identity-stop.spec.ts
  session-isolation.spec.ts
  fixture-fallback.spec.ts
```

`ready-visit.spec.ts` is created during Gate 0 as a failing skeleton and becomes the first complete browser path. The others must pass before demo freeze.

## Required behavioral assertions

- Public request creates Maria exactly once and books the selected 10:30 slot.
- Slot conflict never double-books and offers a deterministic alternative.
- Available intake answers leave `QuestionnaireResponse` in progress while the required member ID is missing.
- Eligibility command spy records zero calls before a valid member ID and exactly one afterward.
- Ready requires a persisted linked eligibility request/response with transaction state `completed`; absent, malformed, failed, or partial persistence keeps the original Task open.
- Missing member ID creates exactly one owned open Task and prevents Ready.
- Supplying the ID sequences coverage update, eligibility evidence, original Task completion, and Ready.
- Unknown payer fields remain `not-returned` or `not-checked`.
- Uncertain identity reveals no PHI, creates one unacknowledged exception, and binds no patient.
- Exact and concurrent/retry Maria submissions conditionally create one Patient/workflow; near-match and forged-identifier submissions bind none.
- Automated actors cannot acknowledge their own exception.
- Malformed or non-administrative output creates no appointment mutation.
- Trace requests and responses update one row; input/output obey tool- and role-specific allowlists.
- Session/role/persona replacement clears trace, copy, cache, and expanded state.
- Public→patient replacement rotates/revokes the old opaque cookie; old-cookie replay fails, state-changing requests enforce same-origin/CSRF, and role/trace responses are `no-store`.
- Physician and public/patient flows coexist only in separate browser contexts; colliding trace IDs cannot cross contexts.
- Voice revoke immediately invalidates the application voice capability, closes the known provider session, denies new provider-token issuance, rejects late/replayed tool events, and still permits deterministic typed administrative commands in the same safely retained/rotated role session. Optional live conformance records provider-token replay behavior during its TTL; core tests do not claim provider-side instant revocation.
- Commit-then-response-loss and `SIGTERM`-after-commit reconcile to one graph and version-specific Provenance without duplicate retry.
- Provider outage preserves the deterministic typed Ready path with an accurate fixture label.
- Seed/reset/seed twice produces one exact linked graph and no unrelated deletion.
- Hosted conformance verifies the baseline `post-commit-versioned` mode; every completed trace resolves exact committed versions, while committed resources with missing lineage remain reconciling/blocked and are never recreated. Atomic optimization is outside the MVP.
- Missing-member and uncertain-identity Task profiles, Questionnaire canonical/version/linkIds/source/author/version transition, `$book` returned refs, and eligibility omission mapping pass their frozen conformance tests.
- The browser bundle, logs, URLs, trace, and rendered DOM contain no credential or prohibited payload.
- Normative MVP copy contains no legacy call-only headline or metric; voice remains one optional channel for a request.

## Per-lane RED/GREEN handoff

Every task handoff records:

```markdown
Outcome:
Owned files changed:
RED command:
Expected failing assertion:
Observed RED result:
GREEN commands and results:
Refactor performed:
Manual verification:
Remaining risks:
Requested contract change:
```

A requested contract change stops only the affected behavior. The writer continues independent work against the existing fixture and asks the root integrator to revise the shared contract. Writers never patch shared schemas themselves.

## Merge and release gates

### G0 — Harness

The minimum parallelization freeze provides scaffold, writer test commands, four route shells, Wave 1 contracts, immutable fixtures, ownership, minimal `/health`, and a committed bounded `scripts/gate-0a.sh` that passes in a clean clone and all three sibling worktrees. Root completes full environment/health/lifecycle tests, Railway behavior, trace server, and the failing critical browser skeleton concurrently in Gate 0B before G3.

### G1 — Contract freeze

All boundary schemas have positive/negative tests; route/session matrix, command names, fixture clock/IDs/copy, and file ownership are frozen.

### G2 — Lane green

Domain, FHIR, and UI worktrees independently pass their owned suites, typecheck, lint, and path-ownership audit.

### G3 — Fixture slice

The deterministic typed request reaches Ready; uncertain identity stops; traces render; no optional provider is required.

### G4 — Medplum

The hosted test project contains one correct graph; scheduling conflict, expected versions, Provenance, response-loss reconciliation, and seed/reset pass.

### G5 — Security and Railway runtime

Role/session isolation, trace allowlists, secret scan, `PORT`, `/health`, SPA deep links, and graceful shutdown pass. Consent-gated token tests run against a root-owned fixture `VoiceTokenProvider`; absent/declined/revoked consent returns `403`, valid fixture consent is session/role-bound, and typed fallback survives revoke. Live Deepgram token conformance remains behind the optional-provider gate.

### G6 — Browser proof

The happy path, identity stop, session isolation, and fixture fallback pass from a clean reset.

Optional Deepgram/Stedi work cannot start until G0–G6 and one sub-three-minute rehearsal are green.

### G7 — Demo freeze

`typecheck`, `lint`, all tests, and build are green; no unresolved CRITICAL/HIGH reviewer finding exists; accepted MEDIUM risks are recorded; three rehearsals finish under three minutes.
