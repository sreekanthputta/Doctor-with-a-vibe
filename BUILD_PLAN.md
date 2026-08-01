# VibeDoc Multi-Agent Build Plan

> Normative priority: subordinate to `AGENTS.md`, `HACKATHON.md`, `CLINIC.md`, and `ARCHITECTURE.md`.

## ECC-derived execution model

ECC was inspected at commit `e4e4163101f162881e628f300a9ca4e6a940bcea` (July 29, 2026). Adopt these patterns:

- plan and contracts live in the repository, not only in chat;
- build one thin end-to-end slice before feature breadth;
- map dependencies and file ownership before parallel work;
- one integrator owns shared contracts, composition, dependency files, and merges;
- writers receive outcome, owned paths, forbidden paths, acceptance tests, and handoff format;
- reviewers are fresh-context and read-only;
- integrate every 60–90 minutes;
- verify tests, diff, security, failure states, and demo before declaring done.

Do not copy ECC's large catalog of generic agents/skills, legacy Codex configuration, hook/control-plane machinery, blanket coverage targets, or ceremony unrelated to this hackathon.

## Build DAG

```text
[0 scaffold + scripts + env example + Railway contract]
                |
[1 freeze schemas + fixture + stable IDs + trace contract + approved tokens]
       /              |                  \
[2 domain/policy] [3 FHIR/data] [4 UI from view-model fixture]
       \              |                  /
        [5 fixture end-to-end integration]
                    |
      [6 live Medplum + reset/idempotency]
                    |
 [7 Stedi adapter]       [8 Deepgram adapter]
          \                /
       [9 safety/race/outage/E2E]
                    |
         [10 reviewer council + fixes]
                    |
          [11 freeze, rehearse, record]
```

Steps 7 and 8 are independent and optional. They never block the typed fixture path.

## Gate 0: integrator-only contract freeze

Before parallel writers:

1. Scaffold one strict-TypeScript React application with minimal server routes.
2. Add scripts: `dev`, `typecheck`, `lint`, `test`, `build`, `demo:seed`, `demo:reset`, and one critical browser test.
3. Create `.env.example` with placeholder names and server-only environment validation.
4. Add one Railway service contract: `npm run build`, `npm run start`, injected `PORT`, `/health`, and graceful `SIGTERM` handling.
5. Freeze runtime and sanitized function-trace schemas from `ARCHITECTURE.md` and `TRACING.md`.
6. Freeze VibeDoc, fictional family physician Dr. Maya Chen, adult patient Maria Lopez (`maria-demo`), annual-wellness scenario, missing synthetic insurance member ID, eligibility fixture, stable resource identifiers, and reset manifest.
7. Freeze route shells from `UI.md`; freeze color tokens only after a generated direction is approved.
8. Freeze the Medplum scheduling seed constraints and eligibility/QuestionnaireResponse mappings from `ARCHITECTURE.md`.

`demo:seed` and `demo:reset` must target only the namespaced synthetic manifest, require an explicit development/admin context, and never be exposed as public production routes.

Only the root/integrator edits package manifests/lockfiles, shared contracts, route composition, global styles/tokens, and CI.

## Parallel Wave 1

### Lane A — domain/workflow builder

Owned paths:

```text
src/domain/**
src/domain/**/*.test.*
```

Outcome:

- pure state reducer;
- annual-wellness practice policy;
- identity gate;
- deterministic clinical-language stop;
- closed administrative-intent grammar with default-deny handling;
- insurance-member-ID completeness rule;
- idempotent Task commands;
- Ready derivation.

Forbidden: React, provider SDKs, direct Medplum calls, package files, shared contract edits.

### Lane B — FHIR/data builder

Owned paths:

```text
src/fhir/**
src/demo/seed/**
src/fhir/**/*.test.*
```

Outcome:

- seed/reset manifest;
- resource mappings from `ARCHITECTURE.md`;
- centralized allowlisted mutation service;
- version/idempotency behavior;
- scheduling fixture and Medplum implementation;
- one-actor/timezone/SchedulingParameters/service-reference seed conformance;
- Task, CommunicationRequest/Communication, eligibility projection, QuestionnaireResponse lifecycle, and Provenance tests.

Forbidden: UI, Deepgram/Stedi/telephony SDKs, package files, shared contract edits. Medplum libraries are allowed inside this lane's FHIR boundary.

### Lane C — UI builder

Owned paths:

```text
src/ui/**
src/ui/**/*.test.*
```

Outcome:

- warm patient landing/conversation/dashboard;
- Synthetic Demo Access banner/persona;
- Ready Visit Rail including Needs attention;
- dark physician Tomorrow/Exceptions/evidence cockpit;
- compact expandable function rows with running/completed/failed fixture states;
- loading, empty, stopped, stale, retry, live/prerecorded/fixture labels;
- keyboard and accessibility baseline.

The UI consumes frozen `ReadyVisitVM` fixtures. It contains no FHIR/provider calls or business-state derivation.

### Root/integrator lane

Owned paths:

```text
package.json and lockfile
shared contracts
src/adapters/**
src/server/**
app/router composition
integration/e2e tests
demo script
```

Outcome:

- typed deterministic conversation adapter;
- provider interfaces/fixtures;
- server token/tool boundary;
- Railway start/health/shutdown contract and sanitized local/SSE trace transport;
- role-bound session matrix, consent-gated token issuance, and sanitized security-event sink;
- integration of lanes into the vertical slice;
- optional Stedi and Deepgram adapters after the fixture slice is green.

## Task-card contract

Every delegated task must specify:

```yaml
id: OP-###
outcome: one user-visible or contract-visible result
owner: agent/lane
state: backlog | ready | running | review | blocked | merged
dependencies: []
owned_paths: []
forbidden_paths: []
acceptance: []
verification: []
merge_gate: checks required before integration
handoff: changed files, commands/results, screenshots for UI, remaining risks
```

An agent must not expand its owned paths. Missing shared contracts are requested from the integrator; the lane continues against a local fixture rather than silently changing global types.

## First-day board

| ID | Task | Owner | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| OP-001 | Runnable scaffold/scripts/env example | Integrator | none | dev/typecheck/test/build commands exist |
| OP-002 | Freeze schemas, fixture, IDs, trace contract, approved tokens | Integrator | OP-001 | all three lanes compile against contracts |
| OP-005 | Railway runtime and health contract | Integrator | OP-001 | one service listens on `PORT`, serves SPA/API, passes `/health`, and drains safely |
| OP-006 | Sanitized live function-trace transport | Integrator | OP-003 | local/SSE updates merge by ID and session/role/subject allowlists prevent leaks; failure falls back to fixture trace state |
| OP-101 | Workflow reducer and safety/readiness rules | Domain | OP-002 | pure tests cover happy, missing-field, identity-stop |
| OP-201 | Seed/reset and FHIR mutation service | FHIR | OP-002 | rerun produces no duplicates |
| OP-301 | Patient + physician UI and trace rows against fixtures | UI | OP-002 | all states render, trace expands/updates, and keyboard path works |
| OP-003 | Fixture vertical-slice integration | Integrator | OP-101/201/301 | typed request reaches completed Task and Ready cockpit with deterministic fixture trace rows; no SSE dependency |
| OP-202 | Live Medplum reads/writes and scheduling adapter | FHIR | OP-003 | actual graph visible; slot conflict handled |
| OP-004 | Critical browser path and security evidence | Integrator | OP-202 | exact screen sequence, sanitized application audit event, and reset-through-safety replay pass |
| OP-401 | Stedi approved test/fixture adapter | Integrator | OP-003 | same normalized result and visible source label |
| OP-402 | Deepgram live adapter/token route | Integrator | OP-003 | voice and InjectUser map to same intent; failure bypass works |
| OP-501 | Reviewer council and fixes | Reviewers/root | OP-004 | no unresolved HIGH/CRITICAL |
| OP-502 | Freeze/rehearse/backup recording | Root | OP-501 | three sub-three-minute runs from reset |

## Integration cadence

- T+0:30: scaffold and contracts frozen
- Every 60–90 minutes: each writer hands off one green bounded change set; root integrates immediately
- T+2:30: fixture path renders `Needs attention -> Ready`
- T+4:00: live Medplum graph, seed/reset, eligibility fixture, provenance
- T+5:15: safety replay, slot race, outage fallback, critical browser test
- T+6:15: feature freeze; only HIGH/CRITICAL fixes and demo polish

No lane carries unintegrated work longer than 90 minutes. In a shared working tree, builders do not commit: they report exact changed paths and checks, and the integrator stages only those paths after verifying the combined tree. Use isolated worktrees when lanes need independent commits, broad edits, or dependency changes; the integrator alone reconciles shared contracts and lockfiles.

## Quality gates

Per bounded handoff:

- tests for affected pure behavior;
- typecheck for owned area;
- clean diff and no unrelated files;
- UI screenshot/manual state verification when applicable.

At every integration cut:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Before freeze:

- malformed intent/provider/tool output rejected;
- wrong/uncertain identity reveals no PHI;
- symptom-bearing input produces no classification, reassurance, or disposition;
- unmatched or mixed clinical/administrative input creates exactly one owned `requested` Task and no appointment mutation;
- only the configured human role can transition an exception from `requested` to `accepted`;
- slot race cannot double-book;
- missing insurance member ID creates exactly one Task; supplying it records eligibility evidence, completes the Task, and makes Ready;
- every open required Task status makes Ready false, while completed Task history does not increment the exception badge;
- absent payer fields remain not-returned/not-checked;
- eligibility request/response mandatory fields, payer organization, request reference, coverage reference, and source identifier validate;
- QuestionnaireResponse remains in-progress until required answers validate and preserves subject/source/author/authored;
- preview-only reminders cannot create completed Communication; actual in-app delivery records the event;
- `$find -> $book` validates the schedule/slot/appointment graph and competing booking maps to `SlotConflict`;
- patient route cannot invoke clinician/billing tools;
- public-booking, patient-demo, and physician-demo sessions cannot reuse or promote one another's role or tool allowlist;
- the verbatim stage sentence maps to annual-wellness intent in both scripted and live-adapter contract tests;
- token issuance returns `403` before voice-processing acknowledgment and after decline/revoke;
- revocation tears down active capture/WebSocket/media queues and late provider frames or unexecuted proposals cannot mutate state;
- the visible application security event contains only event ID, timestamp, actor role, action class, decision, correlation ID, and fixture/live label and is never rendered as Provenance;
- trace input/output pass tool- and role-specific allowlists; server-derived session/role/subject bindings reject same-role cross-session/persona access; request/response update one row; reconnect/replay causes no duplicate mutation;
- client trace state is namespaced by server session/role/subject, clears on context replacement, and colliding IDs cannot retain, merge, expand, or copy prior-persona output;
- secrets, headers, prompts, chain-of-thought, `thought_signature`, raw provider payloads, raw audio/transcripts, and unrestricted FHIR resources never render in a trace;
- Railway starts from committed scripts on the injected `PORT`, `/health` passes, and shutdown prevents late tool events from mutating state;
- only the centralized writer mutates FHIR;
- Deepgram/Stedi/model outage completes the typed fixture path;
- reset/rerun creates no duplicates;
- explicit demo `Identifier.system`/`value` constants are used consistently; a documented legacy-value fixture fails closed or migrates under the integrator, and reset plus two seeds leaves exactly one linked graph;
- commit-response-loss and `SIGTERM`-after-commit reconcile by idempotency identifier to one graph and version-specific Provenance without a false failure or duplicate retry;
- secret scan and browser/log inspection find no credentials or PHI payloads;
- one deterministic critical browser path passes.

## Review waves

Run the existing four read-only reviewers in two waves of up to three concurrent threads:

1. Product impact, clinical safety, and FHIR
2. Security/demo

Each finding requires severity, evidence, trigger, impact, and smallest fix/test. Root deduplicates and owns remediation. Reviewers never edit. Run at architecture freeze, first integrated vertical slice, and demo freeze—not on trivial changes.

## Scope cut order

1. Live microphone; keep typed/prerecorded path
2. Live Stedi; keep labeled fixture
3. Multiple patients/visit types
4. Encounter transcription and clinical chat
5. Orders/referrals/prescriptions/claims
6. Workflow builder and visible multi-agent animation

Never cut the deterministic typed path, Medplum graph, safety stop, Task completion/readiness rule, provider labels, seed/reset, or rehearsed demo.

## Post-MVP medication evidence spike

Do not start this during the administrative build. After clinical-chat prerequisites and external clinical/privacy review, run a separate benchmark spike:

1. Freeze a synthetic medication-question corpus and required DailyMed sections.
2. Implement RxNorm normalization plus direct DailyMed retrieval as the baseline.
3. Define the validated rule/interaction provider separately; an LLM, Moss, RxNorm, and DailyMed are not substitutes.
4. Index only public label chunks in Moss with RxCUI/product, ingredient, `setId`, version/effective time, section, and source URL.
5. Compare required-section recall, stale-version rejection, p95 latency, token reduction, deletion/update behavior, offline/failure behavior, and citations.
6. Adopt Moss only if it improves speed/context without lowering recall or traceability. Patient facts remain exact Medplum queries and never enter the Moss index or query.
