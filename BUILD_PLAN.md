# VibeDoc Parallel Test-First Build Plan

> Normative priority: subordinate to `AGENTS.md`, `HACKATHON.md`, `CLINIC.md`, and `ARCHITECTURE.md`; paired with `TEST_PLAN.md`.

## Execution model

ECC was inspected at commit `e4e4163101f162881e628f300a9ca4e6a940bcea` (July 29, 2026). VibeDoc adopts its useful implementation discipline:

- plan and contracts live in the repository;
- build one thin vertical slice before breadth;
- freeze dependencies, schemas, fixtures, routes, tests, and ownership before writers start;
- one integrator owns shared composition and merges;
- concurrent writers use exclusive paths and isolated worktrees;
- every behavioral task records RED → GREEN → REFACTOR evidence;
- integrate green change sets every 60–90 minutes;
- fresh-context reviewers report evidence and never edit.

Do not copy ECC's generic agent catalog, control-plane/hooks, legacy Codex schema, blanket coverage target, or unrelated ceremony.

## Dependency DAG

```text
Gate 0 — root scaffold + test harness + frozen contracts/fixtures/routes
                              |
           +------------------+------------------+
           |                  |                  |
           v                  v                  v
Wave 1 A: domain       Wave 1 B: FHIR      Wave 1 C: UI
tests -> behavior      tests -> mappers     tests -> shells
           |                  |                  |
           +------------------+------------------+
                              |
                    root fixture integration
                              |
           +------------------+------------------+
           |                  |                  |
           v                  v                  v
Wave 2 A: Deepgram    Wave 2 B: Medplum    Wave 2 C: Stedi
optional provider      live conformance      optional provider
           +------------------+------------------+
                              |
        root trace/SSE + sessions + Railway + E2E + reviewers
                              |
                      freeze and rehearse
```

Deepgram and Stedi are optional. The deterministic typed fixture path cannot depend on either. Live trace transport cannot block the Ready flow; deterministic trace fixtures remain available.

## Gate 0A — minimum parallelization freeze

Before spawning implementation writers, the root completes and commits only the shared minimum needed for independent Wave 1 work:

1. Scaffold one strict-TypeScript React application with a minimal Node server and one Railway start path.
2. Lock package versions and configure Vitest, React Testing Library, `user-event`, Playwright, ESLint, TypeScript, and build tooling.
3. Add scripts required by writers: `dev`, `start`, `typecheck`, `lint`, `test`, `test:unit`, and `build`. `start` serves the initial built shell and a minimal `/health`; sessions, SSE, reconciliation, and full shutdown behavior remain Gate 0B.
4. Freeze only the Wave 1 Zod schemas and inferred types in `src/contracts/**`: administrative intents, identity decision, workflow events/states, domain/FHIR commands, provider ports used by fixtures, session context, trace presentation, and Ready-visit view models.
5. Freeze the immutable root fixture in `src/test/fixtures/**` from `TEST_PLAN.md`.
7. Freeze the four shells: `/`, `/demo`, `/patient/*`, and `/physician/*`; no patient/resource identifiers in URLs.
8. Freeze the conservative `post-commit-versioned` MVP Provenance mode, explicit identifiers, Task profiles, Questionnaire canonical/linkIds/version rules, eligibility transaction state, and an adapter-independent cleanup contract. Hosted `$book`/identifier/returned-ref behavior is verified at the FHIR live gate before OP-202, not before Wave 1.
9. Freeze layout/spacing/typography roles, semantic token names, and component states. Concrete color values and visual snapshots wait for user palette approval.
10. Add the minimum positive/negative contract tests needed by Wave 1.
11. Freeze writer tasks, exclusive paths, worktrees, branch names, and handoff directories.

The reset seed includes practice configuration, payer, physician/role, service, schedule, two slots, Questionnaire, and policies. It does not pre-create Maria or the workflow graph. Maria's public request creates the Patient and later resources with stable business identifiers. `demo:seed`/`demo:reset` require explicit development/admin context and are never public production routes.

Gate 0A is not complete until root creates and commits `scripts/gate-0a.sh` plus `npm run gate:0a`. The script must be non-interactive and reproducible:

```text
npm ci
npm run typecheck
npm run lint
npm test -- src/contracts
npm run build
start `npm run start` with PORT=43117
poll http://127.0.0.1:43117/health for at most 30 seconds
require HTTP 200
always terminate the spawned process through an EXIT/INT/TERM trap
```

The script rejects a dirty tree, occupied test port, missing lockfile, or leaked child process and writes no secret-bearing output. Root runs it from a temporary clean clone of the Gate 0A commit and records exit `0` in the Gate 0 handoff. Root then creates sibling worktrees—not nested directories—with explicit commands equivalent to:

```bash
git worktree add ../vibedoc-domain -b lane/domain <gate-0a-commit>
git worktree add ../vibedoc-fhir -b lane/fhir <gate-0a-commit>
git worktree add ../vibedoc-ui -b lane/ui <gate-0a-commit>
```

Root runs `npm run gate:0a` sequentially in each worktree before assignment, using the same bounded port/cleanup behavior. Branch/path existence stops with instructions; the script never deletes an existing branch or directory. Writers do not wait for sessions, SSE, full Railway shutdown/reconciliation, hosted Medplum, optional-provider schemas, or a completed browser test.

## Gate 0B — root work concurrent with Wave 1

While writers implement their owned modules, root adds the remaining shared runtime in test-first increments:

- integration/E2E, seed/reset, and remaining Railway scripts/behavior;
- `.env.example`, server-only validation, `railway.toml`, injected `PORT`, `/health`, SPA fallback, and `SIGTERM` behavior;
- public/patient/physician session gateway and tool matrices;
- server trace projection schemas, store, snapshot, SSE, redaction, and reconciliation;
- security-event schemas, integration harness, secret scan, and failing Playwright critical path;
- optional-provider contracts only when their entry gate is reached.

Gate 0B may not mutate a frozen Wave 1 contract silently. A required change pauses only affected lanes, is committed/versioned by root, and is adopted by writers at a green boundary with an explicit handoff note.

## Worktree strategy

Intentional red tests must not contaminate other agents. After the Gate 0A commit, root creates three isolated sibling worktrees/branches:

```text
../vibedoc-domain   branch lane/domain
../vibedoc-fhir     branch lane/fhir
../vibedoc-ui       branch lane/ui
```

Writers may commit only green bounded changes in their worktree. They never merge, rebase shared contracts, or push `main`. Root reviews and merges/cherry-picks explicit green commits into `main`, runs the combined gates, and resolves shared conflicts. In a shared-tree fallback, only one writer may be in an intentional RED phase at a time; isolated worktrees are the default.

## Frozen ownership

| Owner | Owned paths | Forbidden shared paths |
| --- | --- | --- |
| Root integrator | `src/contracts/**`, `src/test/fixtures/**`, `src/app/**`, `src/server/**`, initial `src/adapters/**`, `src/styles/**`, `tests/integration/**`, `tests/e2e/**`, `scripts/**`, configs, package/lock, Railway | writer-owned paths except explicit integration fixes after handoff |
| Lane A — domain | `src/domain/**`, `handoffs/domain/**` | contracts, fixtures, FHIR, UI, adapters/providers, server/app/styles, integration/E2E, configs/package/lock |
| Lane B — FHIR | `src/fhir/**`, `src/demo/seed/**`, `handoffs/fhir/**` | contracts, fixtures, domain, UI, adapters/providers, server/app/styles, integration/E2E, configs/package/lock |
| Lane C — UI | `src/ui/**`, `handoffs/ui/**` | contracts, root fixtures, domain, FHIR, adapters/providers, server/app/router, global styles/tokens, integration/E2E, configs/package/lock |

Cross-lane imports use only public contract exports. Writers request contract changes from root and continue independent work; they never silently edit a shared schema.

## Wave 1 task cards

### OP-101 — Domain/workflow lane

Outcome:

- closed administrative grammar and negative corpus behavior;
- pure identity/privacy and clinical-language stop gates;
- annual-wellness scheduling policy;
- pure workflow reducer;
- member-ID completeness and Task command planning;
- Ready derivation and active-exception count;
- idempotent command planning and human-only acknowledgment rule.

Acceptance:

- the exact stage request maps to annual-wellness intent;
- happy path reaches `needs-attention`, then `ready` after ordered evidence;
- every open required Task prevents Ready; completed history does not increment active exceptions;
- uncertain identity binds no patient, reveals no PHI, and emits exactly one owned requested exception command;
- exact/parallel Maria requests follow the tri-state identity contract and conditionally create one workflow; client identifiers and near matches stop;
- unmatched, misspelled, negated, euphemistic, and mixed clinical/administrative inputs issue no appointment mutation;
- every clinical/mixed stop returns the exact fixed safety copy without classification or personalization;
- repeated events create no duplicate command;
- automated identity cannot acknowledge an exception.

Verification:

```bash
npm test -- src/domain
npm run typecheck
npm run lint
```

### OP-201 — FHIR/data lane

Outcome:

- pure FHIR resource mappers;
- fixture scheduling repository and explicit `SlotConflict`;
- reset/seed manifest implementation;
- centralized allowlisted mutation service;
- Patient/Coverage/QuestionnaireResponse mappings;
- Task and CommunicationRequest/Communication lifecycle;
- CoverageEligibilityRequest/Response projection;
- version-specific Provenance;
- idempotency/version and response-loss reconciliation.

Acceptance:

- mappers validate as FHIR R4 and use stable business identifiers;
- `QuestionnaireResponse` stays `in-progress` until required answers, including the synthetic member ID, validate;
- eligibility adapter records zero calls before member ID and exactly one after; incomplete/malformed persistence keeps the Task open and Ready false;
- absent payer fields remain `not-returned`/`not-checked`;
- member-ID resolution updates Coverage, records eligibility evidence, completes the same Task, and then permits Ready;
- preview is not delivered Communication;
- competing booking cannot double-book;
- commit-response loss reconciles before retry;
- reset plus two seeds leaves one exact linked graph and touches no unrelated resource;
- all writes cross the centralized allowlist.
- frozen Task profiles, Questionnaire canonical/version/source/author, eligibility omission projection, `$book` cleanup refs, and selected Provenance mode pass conformance tests.

Verification:

```bash
npm test -- src/fhir
npm run typecheck
npm run lint
```

### OP-301 — Fixture-driven UI lane

Outcome:

- `PublicAccessShell` with embedded front-desk conversation;
- neutral `SyntheticDemoAccessShell`;
- `PatientWorkspaceShell` with internal appointment/intake/coverage/message panels;
- `PhysicianCockpitShell` with Tomorrow, Exceptions, visit workspace, and evidence drawer;
- Ready Visit Rail and exception inbox;
- compact expandable trace rows with updating fixture states;
- loading, empty, stopped, stale, forbidden, retry, provider-outage, and fixture/live states;
- keyboard and accessibility behavior.

Acceptance:

- all four shells render frozen view models;
- `Needs attention` never renders as Ready;
- trace request/response updates one row and shows only the supplied sanitized projection;
- replacing session/role/persona clears trace, cache, expansion, and copy state;
- patient UI exposes no physician action or internal resource ID;
- next appointment is suggested but never silently opened for write/recording;
- uncertain exception shows human owner, due time, and `requested · unacknowledged`;
- loading/error/empty/401/403 render no stale prior data;
- `J/K`, `E`, `Enter`, command palette, focus return, ARIA-live, reduced motion, target size, and non-color status cues work.

The lane may implement structural CSS through root-frozen semantic tokens. Concrete palette values and visual regression baselines wait for the user's A/B/C/blend decision.

Verification:

```bash
npm test -- src/ui
npm run typecheck
npm run lint
```

## Root/integrator lane during Wave 1

Root works only on shared composition and tests that do not overlap writer paths:

- contract/fixture fixes requested by lanes;
- deterministic scripted conversation and eligibility adapters;
- router and four-shell composition;
- role/session/tool gateway;
- sanitized trace store/snapshot/SSE boundary;
- Railway server and environment contract;
- integration/E2E harness and secret scan.

Root does not pre-implement a writer's behavior. Cross-lane integration begins only from green handoffs.

## Required Wave 2 reassignment

After Wave 1 handoffs are merged, all capacity remains on the required deployed proof:

| Task | Temporary owner | Owned paths/outcome | Dependency |
| --- | --- | --- | --- |
| OP-102 workflow robustness | former Lane A | additional negative/idempotency/property cases in `src/domain/**` | OP-101 merged |
| OP-202 hosted Medplum transport/conformance | former Lane B | `src/fhir/medplum/**`, `handoffs/medplum/**` | OP-201 merged |
| OP-302 demo UI/accessibility polish | former Lane C | remaining state/accessibility behavior in `src/ui/**` | OP-301 merged |

The root owns server/session/trace/Railway/E2E composition concurrently. Hosted Medplum is required.

OP-202 begins with the FHIR live gate: a synthetic hosted test for conditional Patient create, `$book` identifier/returned Appointment+Slot references, safe cleanup, and post-commit version-specific Provenance. It records the observed behavior before implementing the transport. Failure blocks OP-202, not Wave 1 domain/FHIR/UI fixture work.

### Optional-provider entry gate

Deepgram (`src/providers/deepgram/**`) and Stedi (`src/providers/stedi/**`) may enter `in_progress` only after G0–G6 are green and one complete rehearsal finishes under three minutes. Root then explicitly reassigns a freed lane and freezes its provider contract. If either threatens the feature-cut deadline, retain the labeled fixture and stop provider work.

## Root integration tasks

| ID | Result | Dependencies |
| --- | --- | --- |
| OP-001 | scaffold, scripts, environment, Railway, test harness | none |
| OP-002 | contracts, immutable fixtures, routes, sessions, ownership frozen | OP-001 |
| OP-003 | deterministic typed fixture slice including fixture traces | OP-101, OP-201, OP-301 |
| OP-004 | role/session gateway, trace redaction and deterministic security evidence | OP-003 |
| OP-005 | live Medplum graph, seed/reset, idempotency, provenance | OP-202 |
| OP-006 | sanitized live trace SSE; fixture fallback remains | OP-003 |
| OP-007 | Railway lifecycle, health, deep links, shutdown reconciliation | OP-003, OP-005 |
| OP-501 | reviewer council and fixes | OP-004, OP-005, OP-007 |
| OP-502 | freeze, three rehearsals, backup recording | OP-501 |

## Task handoff contract

Every task creates `handoffs/<lane>/OP-###.md` containing:

```yaml
id: OP-###
outcome: one user-visible or contract-visible result
owner: lane
state: review
dependencies: []
owned_paths: []
forbidden_paths: []
acceptance: []
verification: []
merge_gate: []
```

And records:

- files changed;
- RED command, intended assertion, and observed failure;
- GREEN commands and results;
- refactor performed;
- manual verification and UI screenshot when applicable;
- assumptions, remaining risks, and requested shared-contract changes.

A handoff with a red owned suite, unrelated change, missing evidence, or out-of-lane file is rejected.

## Integration cadence

Progress is gate-based, not promised by an unmeasured hour estimate:

1. Run the committed `npm run gate:0a` from a clean clone, record exit/duration, create sibling worktrees, and run it sequentially in each.
2. Create three worktrees only after the Gate 0A exit check passes.
3. Every 60–90 minutes, each writer hands off a bounded green commit; root integrates immediately.
4. Do not begin required Wave 2 until the combined deterministic fixture slice is green.
5. Do not begin optional providers until G0–G6 and one full rehearsal are green.
6. Set a hard feature-cut deadline at least two hours before submission; after it, only CRITICAL/HIGH remediation, deterministic-demo fixes, rehearsal, and recording are allowed.

No worktree carries unintegrated work longer than 90 minutes. At every integration cut root runs:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Merge gates

`TEST_PLAN.md` defines the detailed G0–G7 gates. Additionally:

- only explicit green writer commits are integrated;
- no dependency or lockfile change comes from a writer lane;
- optional provider failures cannot break fixture tests;
- UI snapshot/color approval is not required for the logic slice but must be resolved before visual freeze;
- no unresolved CRITICAL/HIGH reviewer finding may cross a demo-critical merge;
- accepted MEDIUM risk is written into the relevant task handoff and demo-freeze report.

## Review waves

At contract freeze, first integrated fixture slice, and demo freeze run:

1. product-impact, clinical-safety, and FHIR reviewers in parallel;
2. security/demo reviewer in the next available slot.

Reviewers are read-only. Each actionable finding includes severity, exact evidence, reproducible trigger/missing state, impact, and smallest fix/test. Root deduplicates and owns remediation.

## Scope cut order

1. Live microphone; retain typed/prerecorded input.
2. Live Stedi; retain labeled eligibility fixture.
3. Live trace transport; retain deterministic expandable trace fixtures.
4. Multiple patients/visit types.
5. Encounter transcription and clinical chat.
6. Orders/referrals/prescriptions/claims.
7. Workflow builder or visible multi-agent animation.

Never cut the deterministic typed path, four-shell trust separation, Medplum graph, identity/privacy stop, Task completion/readiness invariant, exact payer vocabulary, seed/reset, Provenance, or rehearsed demo.

## Post-MVP medication evidence spike

Do not start during the administrative build. After clinical-chat prerequisites and external clinical/privacy review:

1. freeze a synthetic medication-question corpus and required DailyMed sections;
2. implement RxNorm normalization plus direct DailyMed retrieval baseline;
3. define validated rule/interaction provider separately;
4. optionally index only public label chunks in Moss with version metadata;
5. compare recall, stale-version rejection, p95 latency, token reduction, updates/deletion, offline/failure behavior, and citations;
6. adopt Moss only if it improves the workflow without lowering recall or traceability; patient facts never enter Moss.
