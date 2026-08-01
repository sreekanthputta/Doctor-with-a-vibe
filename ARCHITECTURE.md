# VibeDoc Canonical Architecture

> Normative priority: subordinate to `AGENTS.md`, `HACKATHON.md`, and the fictional-practice scope in `CLINIC.md`; authoritative for technical component boundaries.

## System boundary

```text
Browser voice / typed web
          |
          v
ConversationAdapter
  live: Deepgram Voice Agent
  fallback: deterministic scripted intent
          |
          v
identity/session gate
          |
          v
schema-validated AdministrativeIntent
          |
          v
versioned practice-policy engine
          |
          v
deterministic workflow state machine
          |
          v
scoped provider adapters
          |
          v
central FHIR mutation service
          |
          v
Medplum resources + Provenance
```

Future PSTN and SMS enter through separate telephony/messaging adapters. Deepgram provides conversational speech, Think/LLM output, and function-call proposals. Those outputs are untrusted. VibeDoc owns identity, authorization, policy, workflow transitions, confirmation, idempotency, mutations, and exceptions.

## Deployment shape

Use one strict-TypeScript application deployed as one long-running Railway service with React and minimal Node server routes. The service listens on Railway's injected `PORT`, exposes `/health`, serves the SPA and role-bound APIs from one origin, and drains active provider/trace sessions on `SIGTERM`. Do not create a second clinical database or a general workflow platform. See `DEPLOYMENT.md`.

### Browser

- Patient landing/conversation and synthetic dashboard
- Physician Tomorrow/Exceptions cockpit
- Microphone, playback, typed input, live transcript
- User-scoped Medplum reads where authorization permits
- Local presentation/navigation tools
- Compact function traces driven by sanitized local and server events
- Uncommitted draft view models

### Minimal server gateway

- Deepgram short-lived token issuance
- Server-recorded, versioned voice-processing acknowledgment required before token issuance
- Public/demo session and booking policy gate
- Stedi secret-bearing requests
- Central privileged/provider tool dispatcher
- Role-bound Server-Sent Events stream and current snapshot for sanitized function-trace updates
- Sanitized application security-event sink for decision metadata only; no PHI payloads
- Messaging, telephony, webhooks, and background jobs when added
- Organization/service credentials

The gateway is a security and orchestration boundary, not another source of clinical truth.

## Implementation modules

Dependencies point inward toward frozen runtime contracts and pure domain behavior. Provider SDK types never leak into domain or UI modules.

```text
src/contracts/**       Zod schemas + inferred types; integrator-owned
src/test/fixtures/**   immutable cross-lane demo/provider/view-model fixtures; integrator-owned
src/domain/**          pure policy, reducer, readiness, idempotent command planning
src/fhir/**            FHIR mappings, seed/reset manifest, repository, mutation writer
src/ui/**              four page shells, components, view-model fixtures
src/adapters/**        initial scripted conversation/eligibility implementations; integrator-owned
src/providers/**       optional Deepgram/Stedi implementations added in Wave 2
src/server/**          role sessions, tool gateway, SSE, health, shutdown
src/app/**             router/composition only; integrator-owned
tests/integration/**   cross-module fixture/Medplum tests; integrator-owned
tests/e2e/**           four-shell browser path; integrator-owned
```

Allowed dependency direction:

```text
UI -> contracts
domain -> contracts
FHIR/adapters/server -> contracts + domain
app composition -> all modules
```

`src/domain` never imports React, Medplum, provider SDKs, server code, or the UI. `src/ui` never imports Medplum/provider SDKs or the central FHIR writer. Cross-lane behavior is exercised through frozen contracts and fixtures rather than private imports.

## Route and session shells

| Shell | Route family | Session authority |
| --- | --- | --- |
| Public access | `/` | `public-booking` only |
| Synthetic demo access | `/demo` | neutral; creates a new allowlisted role session |
| Patient workspace | `/patient/*` | `patient-demo` bound to `maria-demo` |
| Physician cockpit | `/physician/*` | `physician-demo` bound to Dr. Maya Chen |

Conversation is embedded in `/`; it is not a separate fifth shell. Patient intake/appointment and physician visit/exception details are nested panels or client routes inside their parent shell. The server issues a new role-bound session for every trust-domain transition; client navigation never promotes a session.

## Session transport

- Use one opaque `__Host-vibedoc_session` cookie: `Secure`, `HttpOnly`, `Path=/`, no `Domain`, and `SameSite=Lax` (or stricter after deployed-origin verification).
- Never place a session in a URL or local storage. Session bootstrap and all role/trace responses use `Cache-Control: no-store`.
- Public → patient and every persona/role replacement rotate the cookie and revoke the prior server session. Replaying the old cookie returns `401/403` and no cached view remains.
- Physician and public/patient demo surfaces run in separate browser profiles/Playwright browser contexts. Same-origin tabs in one cookie jar are not used to demonstrate simultaneous different roles.
- State-changing requests require the expected same-origin `Origin`/`Referer` plus a server-bound CSRF token from the no-store session bootstrap. SSE/snapshot/tool access derives role/persona only from the server session.
- Session expiry/revocation closes trace streams and clears browser query/cache/trace/copy/expanded state before rendering another actor.

The role session and application voice capability are separate. Voice consent grants a short-lived application capability bound to the current role session; the server may then issue a short-lived provider token. Revoking voice immediately invalidates the application capability, closes the known provider/media session, denies further token issuance, and rejects late or replayed tool events, while preserving or safely rotating the same-role administrative session so deterministic typing continues. An already issued Deepgram token expires according to its provider TTL and is not claimed to be instantly revocable unless live conformance proves otherwise. It contains no PHI or durable workflow authority.

## Test seams

Tests are written before implementation according to `TEST_PLAN.md`. Pure domain tests use no network or clock. FHIR tests use synthetic Bundle fixtures and a repository contract. UI tests use `ReadyVisitVM`/trace fixtures and command spies. Adapter contract tests run the scripted implementation always and optional live providers only behind explicit environment gates. Browser tests exercise the same built Railway entrypoint with external providers disabled by default.

### Function-trace projection

Every dispatched tool emits a stable application `traceId`, provider call ID when present, safe display name, status, timestamps, and tool-specific allowlisted input/output projection inside a server-derived session/role/subject context. Browser-local presentation calls update immediately; server calls stream updates over role-bound SSE. The UI namespaces and merges both sources only inside that immutable authorization context, clears trace state on session/persona replacement, and re-reads Medplum-backed view state after completion. Trace data never grants authority, substitutes for the workflow state machine, or exposes raw tool/provider/FHIR payloads. See `TRACING.md`.

## Provider authority

| Layer | May provide | Never decides |
| --- | --- | --- |
| VibeDoc | typed intents, policy results, workflow transitions, exception routing, UI | clinical facts or payer responses |
| Medplum | durable FHIR patient, clinical, scheduling, workflow, eligibility projection, lineage | live external payer processing result |
| Stedi | timestamped payer/clearinghouse response | coverage guarantee, coding, medical necessity, price certainty |
| Deepgram | speech, Think/LLM output, function-call proposal, agent events | identity, authorization, workflow transition, clinical/financial action |

Medplum is the application source of truth and the only patient-data retrieval layer in this build. Stedi owns its external transaction response; Medplum stores a timestamped normalized projection and source identifier. Do not add a semantic index until exact scoped Medplum queries have a measured limitation.

The deterministic reset seed contains the practice/payer organizations, Dr. Maya Chen and role, HealthcareService, Schedule with two August 4, 2026 slots at 09:30 and 10:30 America/Chicago, the versioned Questionnaire, and published practice policy. It intentionally does not pre-create Maria's Patient or any appointment/workflow resource. The public happy path creates Maria with a stable business identifier and selects the 10:30 slot. Derived UI fixtures may represent later states, but they are not seed authority.

## First-slice resource graph

| State | FHIR resources |
| --- | --- |
| VibeDoc / Dr. Maya Chen / payer | practice and payer `Organization`, `Practitioner`, `PractitionerRole` |
| Bookable visit | `HealthcareService`, `Schedule`, `Slot`, `Appointment` |
| Fictional patient | `Patient`; `RelatedPerson` only when a proxy is part of a later flow |
| Policy supplied by patient | `Coverage` |
| Eligibility transaction projection | `CoverageEligibilityRequest`, `CoverageEligibilityResponse` |
| Intake/member ID response | versioned `Questionnaire`, `QuestionnaireResponse` |
| Missing required field | `Task` |
| Follow-up intent and actual in-app delivery | `CommunicationRequest`, then `Communication` only after display/delivery |
| Committed lineage and security evidence | `Provenance` for resource lineage; separately labeled sanitized application security event in v1; provider/access audit only when actually available |

The Stedi adapter returns a normalized `EligibilityResult`. Both fixture and live test implementations map it to the same FHIR eligibility resources. The request includes `status`, `purpose=['benefits']`, `patient`, `created`, payer `insurer`, `insurance.coverage`, and the serviced date. The response matches patient/purpose/insurer, includes `status`, `created`, `outcome`, and a 1..1 reference to the persisted request. A namespaced business identifier records the Stedi transaction or fixture source. Missing fields remain `not-returned` or `not-checked`; never manufacture boolean verified/covered/in-network claims.

While the synthetic member ID is missing, the `QuestionnaireResponse` remains `in-progress`; it references the versioned Questionnaire canonical and records `subject=Patient`, `source=Patient`, actual recorder in `author`, and `authored`. It becomes `completed` only after required linkIds, types, and cardinalities validate. The corresponding `Coverage` update and eligibility resources retain their own source/lineage.

The Medplum scheduling seed follows the hosted scheduling contract: exactly one actor per `Schedule`, the actor carries the standard timezone extension, `SchedulingParameters` defines duration and availability, and the schedule links the `HealthcareService` through Medplum's service-type-reference extension. The live integration test executes `$find -> $book`, verifies the booked `Appointment` and busy referenced `Slot`, and maps a competing booking `OperationOutcome` to `SlotConflict`.

## Ready-visit state machine

```text
disclosure
  -> identity-check
  -> slot-selection
  -> booked
  -> intake
  -> needs-attention  # required insurance member ID missing
  -> follow-up response / member-ID resolution
  -> eligibility
  -> ready            # original Task completed
```

Separate terminal/safety states: `stopped`, `provider-failure`, `cancelled`.

Canonical readiness rule:

> A visit is Ready only when every v1 required field is present, the booking is current, a linked eligibility request/response transaction has persisted and validated as `completed` from either the labeled fixture or approved live adapter, and no required-field `Task` remains open. Individual benefit fields may still be absent and render `not-returned`/`not-checked`.

Eligibility transaction lifecycle is distinct from benefit-field availability:

```ts
type EligibilityTransactionState =
  | 'not-run'
  | 'in-progress'
  | 'completed'
  | 'failed';
```

`completed` requires a persisted linked `CoverageEligibilityRequest` and `CoverageEligibilityResponse`, validated source/business identifier, and the configured accepted response outcome. The demo fixture uses `outcome='complete'`. Before a valid member ID, the adapter is never called and transaction state remains `not-run`. If the live adapter fails, the labeled fixture may complete the transaction; if both fail or persistence is partial/malformed, the original required Task stays open, Ready remains false, and the UI shows Needs attention/provider failure.

For this derivation, `requested`, `received`, `accepted`, `ready`, `in-progress`, and `on-hold` are open. `completed` is historical and never increments the active-exception badge. `rejected` or `failed` is not Ready; it routes to a new explicit resolution path.

Task acknowledgment uses standard R4 lifecycle where possible:

- `requested`: created and not yet acknowledged
- `accepted`: owner acknowledged
- `in-progress`: resolution underway
- `completed`: requirement resolved
- `rejected`/`failed`: visible exception requiring another path

Assign `Task.owner`; store the due window in `Task.restriction.period`; link patient and appointment. The same idempotent Task completes after the fictional patient supplies the synthetic member ID, `Coverage` is updated, and eligibility evidence is recorded.

The separate uncertain-identity safety replay creates a new owned Task and never enters a patient context or reveals PHI.

## Shared contracts

Runtime schemas are the source; TypeScript types are inferred. Provider SDK objects never cross into domain/UI code.

```ts
type WorkflowStage =
  | 'disclosure'
  | 'identity-check'
  | 'slot-selection'
  | 'booked'
  | 'intake'
  | 'eligibility'
  | 'needs-attention'
  | 'ready'
  | 'stopped'
  | 'provider-failure'
  | 'cancelled';

type SourceEnvelope<T> = {
  value: T;
  source: 'patient' | 'practice-rule' | 'medplum' | 'stedi';
  observedAt: string;
  fixture: boolean;
  resourceRef?: string;
  versionId?: string;
};

type PayerField<T> =
  | { status: 'returned'; value: T; observedAt: string }
  | { status: 'not-returned' | 'not-checked' | 'stale'; observedAt?: string };

type DemoIdentityDecision =
  | { outcome: 'verified-new-demo'; persona: 'maria-demo'; businessIdentifier: string }
  | { outcome: 'exact-existing-demo'; persona: 'maria-demo'; patientRef: string }
  | { outcome: 'uncertain'; safeSessionLabel: string };

type SafetyDecision =
  | { action: 'continue' }
  | {
      action: 'stop';
      category: 'identity' | 'clinical-language' | 'privacy' | 'provider-failure';
      safeCopy: string;
      exception: {
        ownerQueue: string;
        duePolicy: string;
        initialStatus: 'requested';
        idempotencyKey: string;
      };
    };
```

The v1 conversation schema is a closed administrative grammar: disclosure/voice-consent acknowledgment, identity fields, routine annual-wellness scheduling, slot selection, demographics, coverage fields, form answers, and approved administrative FAQs. Any unmatched, mixed clinical/administrative, or non-administrative free text stops by default. A stop and its owned exception `Task` are one reducer outcome/transaction; safe copy never claims that a person has reviewed it.

For the synthetic demo, root freezes Maria's allowlisted normalized identity fields. The server derives `demo-v1:patient:maria`; clients may not submit a business identifier. Exact allowlisted input with no existing identifier yields `verified-new-demo`; exact fields plus the server-derived existing identifier yield `exact-existing-demo`. For two simultaneous exact requests, one conditional create wins and the loser re-reads that single identifier and becomes `exact-existing-demo`. Multiple existing candidates, near matches, forged identifiers, and every other identity yield `uncertain`. There is no fuzzy auto-link or automatic merge. Conditional create/search plus workflow idempotency prevents duplicate Patient or workflow graphs.

Provider interfaces:

- `ConversationAdapter`: emits validated administrative intents; live Deepgram and deterministic scripted implementations
- `SchedulingAdapter`: `search`, `hold`, `book`, `get`; explicit `SlotConflict`
- `EligibilityAdapter`: returns normalized fields and source metadata; never a coverage guarantee
- `ReadyVisitRepository`: read-only composition into one `ReadyVisitVM`
- `FhirMutationService`: sole writer for allowlisted commands

Every command includes `workflowRunId`, `idempotencyKey`, actor/role, source metadata, and expected version where applicable.

## Mutation and concurrency rules

```text
untrusted provider/model input
  -> runtime schema
  -> role/tool allowlist
  -> current patient/session authorization
  -> deterministic policy
  -> explicit confirmation when required
  -> idempotent command
  -> version-aware FHIR transaction
  -> Provenance and audit result
```

- Stable demo identifiers use the explicit FHIR pair `Identifier.system = urn:vibedoc:demo` and `Identifier.value = demo-v1:<resource>:<logical-key>`; never parse a display string as `system|value`.
- Because the application scaffold has not yet existed, no deployed legacy graph is expected. Seed/reset nevertheless checks the namespaced synthetic manifest for the documented pre-rebrand `onepractice|demo-v1:` value form and fails closed with an integrator-only migration instruction instead of silently creating a second graph.
- Slot search and booking use the scheduling adapter; a race returns `SlotConflict` and offers a new slot.
- Repeated function IDs do not authorize or deduplicate anything; VibeDoc idempotency keys do.
- Independent reads may run concurrently. Dependent mutations never run based on LLM array order.
- Approval re-reads sources and verifies base versions. Stale proposals require rebase/review.
- Wave 1 freezes the conservative MVP mode `post-commit-versioned`: validate the committed response, re-read the exact returned version, and create version-specific Provenance as a separate idempotent write. The UI/demo never calls this atomic.
- Before OP-202 live Medplum transport, the FHIR live gate runs a synthetic hosted conformance spike for transaction `fullUrl`/reference resolution, conditional Patient create, scheduling `$book`, identifier propagation, returned versions, exact cleanup refs, and post-commit Provenance targets. An `atomic-versioned` optimization is roadmap-only unless separately proven after G6; it cannot change the Wave 1 contract or block writers.
- A mutation trace reaches `completed` only after the transaction response validates and the committed versions plus expected Provenance targets are confirmed. If a create committed but its follow-up Provenance is missing, the mutation is not retried; it remains `reconciling` or `blocked · committed, lineage pending` until lineage is repaired. A lost response or shutdown after dispatch queries by application idempotency identifier before retrying or terminalizing.

## Frozen FHIR workflow profiles

### Missing-member-ID Task

- stable VibeDoc business identifier;
- `status='requested'`, `intent='order'`;
- `code` uses `system=urn:vibedoc:task-code`, `code=collect-missing-member-id`;
- `for=Patient/Maria`;
- `focus` references the in-progress `QuestionnaireResponse`;
- `supportingInfo` references the Appointment and Coverage;
- `owner` references Dr. Chen's seeded `PractitionerRole`/configured human-review queue;
- `restriction.period` contains the due window.

Supplying the answer may move the Task directly from `requested` to `completed` under the published administrative rule after Coverage, eligibility evidence, and QuestionnaireResponse completion persist. Only a configured human may acknowledge it through `requested -> accepted`; automation never claims acknowledgment.

### Uncertain-identity Task

Use a stable session-derived business identifier, `status='requested'`, `intent='order'`, `code.system=urn:vibedoc:task-code`, `code.code=resolve-uncertain-identity`, accountable human `owner`, and due period. It contains no Patient `for`, Patient focus, candidate identifiers, or PHI. Only the safe session label/correlation metadata may be retained.

### Eligibility field projection

`not-returned`, `not-checked`, and `stale` are application `ReadyVisitVM` states, not invented FHIR benefit or outcome codes. Omitted payer fields remain absent from `CoverageEligibilityResponse.insurance.item`; the mapper never fabricates items. `Coverage.subscriberId` contains the synthetic payer member ID and is distinct from VibeDoc business identifiers.

### Questionnaire and response

Freeze `Questionnaire.url = urn:vibedoc:questionnaire:adult-annual-wellness-intake`, `Questionnaire.version = demo-v1`, and response canonical `urn:vibedoc:questionnaire:adult-annual-wellness-intake|demo-v1`. Exact linkIds are `contact-email` (`string`, 1..1), `contact-phone` (`string`, 1..1), `coverage-payer-name` (`string`, 1..1), `coverage-member-id` (`string`, 1..1 for completion), and `administrative-communication-consent` (`boolean`, 1..1). In the deterministic typed patient path, `source=Patient/Maria` and `author=Patient/Maria`; a future agent-recorded channel uses a separately seeded/authorized Device author. Each save updates `authored`, uses expected-version/If-Match protection, preserves source, and validates against the referenced Questionnaire before changing `in-progress -> completed`.

### Scheduling cleanup

Treat the baseline seed manifest and workflow-run cleanup manifest separately. The hosted spike verifies whether the proposed Appointment business identifier survives `$book`. Always retain the exact returned Appointment and busy Slot references. Reset deletes only exact namespaced workflow references recorded through the verified identifier/lineage mechanism, then restores the two baseline slots; it never broad-searches or deletes unrelated resources.

## Trust boundaries

Public booking, synthetic patient-dashboard, and synthetic physician-cockpit experiences have separate routes, role-bound sessions, prompts where applicable, audit identities, and tool allowlists.

- Public front desk: disclose, collect minimum synthetic registration fields, search allowed availability, submit booking/intake requests through the gateway; no arbitrary patient reads
- Patient demo: read only the allowlisted fictional persona's appointments/forms/coverage/messages and answer its outstanding administrative request; no organization search or physician tools
- Physician demo: read the seeded practice queue and fictional evidence needed for the cockpit; no public-session promotion; clinical proposals remain roadmap and approval-gated
- Billing tools: roadmap with separate accountable user and Stedi production boundary

A public or patient-demo session can never be promoted into physician context. Switching surfaces requires a new server-issued role-bound session. Voice assent is not a clinical signature. `client_side: true` means application-handled, not trusted or safe for direct browser execution.

## Fixture and live parity

The deterministic typed flow is the reliable demo path:

```text
typed input -> ScriptedConversationAdapter -> AdministrativeIntent
```

The optional live path is:

```text
voice or typed InjectUserMessage -> Deepgram -> function proposal -> AdministrativeIntent
```

Both produce the same validated domain commands and view models. If Deepgram disconnects, typing continues without reconnecting to Deepgram. If Stedi fails, the UI visibly selects the timestamped fixture. Provider state is labeled `live`, `prerecorded`, or `fixture` and never disguised.

## Roadmap clinical actions

After v1, the physician cockpit may stage lab/imaging orders, referrals, notes, patient instructions, prescriptions, and claim drafts. `ServiceRequest`, `MedicationRequest`, or `Claim` creation does not prove transmission. Each action follows:

```text
Ask -> inspect sources -> edit/review -> sign -> transmit -> acknowledge -> track to closure
```

External networks and accountable signatures remain mandatory. See `DEEPGRAM.md` for the subordinate tool/action design.

## Roadmap medication evidence retrieval

Moss is excluded from the administrative MVP. It may be evaluated later as a low-latency index over public, versioned medication-label passages when clinical chat is built. It is a retrieval accelerator, not “compressed medical knowledge,” a rules engine, or a source of truth.

```text
doctor names candidate medication
  -> RxNorm normalization and ingredient/product resolution
  -> exact authorized Medplum patient facts
  -> deterministic checks from validated medication knowledge sources
  -> section-scoped Moss retrieval over public DailyMed SPL passages
  -> revalidate source setId/version/current status
  -> evidence-oriented explanation with missing/unavailable checks
  -> doctor reviews and decides; no automatic order
```

Hard boundaries:

- Medplum supplies allergies, medications, conditions, patient-reported history, and relevant observations with status/source/freshness.
- RxNorm supplies normalized identity and relationships; it is not a complete interaction checker, and RxNav's interaction feature was discontinued in January 2024.
- DailyMed supplies current Structured Product Labeling submitted to FDA and supports version history; a label is not a complete interaction, dosing, or patient-safety engine.
- Deterministic allergy-class, duplicate-therapy, drug–drug interaction, contraindication, renal/hepatic, pregnancy, dose, and monitoring checks run only when an appropriate validated knowledge source and required patient inputs are available. Unavailable checks are displayed, never inferred.
- Moss indexes public reference text only, partitioned by RxCUI/product, ingredient, label `setId`, label version/effective time, and section. Patient IDs, chart text, patient facts, prompts containing patient facts, and PHI never enter the index.
- Retrieval runs as multiple section-scoped queries—boxed warnings, contraindications, warnings/precautions, interactions, impairment, special populations, ingredients, and monitoring—rather than one “is this safe?” similarity query.
- Every result is rechecked against the authoritative label/version before display. Stale or missing evidence fails visibly.
- The response says what was checked, not checked, missing, and found. It never says a medication is “safe,” selects treatment/dose, or writes a prescription.

Adoption gate: benchmark exact DailyMed/RxNorm retrieval without Moss against Moss for recall by required section, p95 latency, token reduction, version/deletion correctness, offline behavior, and failure recovery. Add Moss only if it materially improves the clinical workflow without reducing evidence recall or traceability.
