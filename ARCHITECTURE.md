# OnePractice Canonical Architecture

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

Future PSTN and SMS enter through separate telephony/messaging adapters. Deepgram provides conversational speech, Think/LLM output, and function-call proposals. Those outputs are untrusted. OnePractice owns identity, authorization, policy, workflow transitions, confirmation, idempotency, mutations, and exceptions.

## Deployment shape

Use one strict-TypeScript application with React and minimal server routes. Do not create a second clinical database or a general workflow platform.

### Browser

- Patient landing/conversation and synthetic dashboard
- Physician Tomorrow/Exceptions cockpit
- Microphone, playback, typed input, live transcript
- User-scoped Medplum reads where authorization permits
- Local presentation/navigation tools
- Uncommitted draft view models

### Minimal server gateway

- Deepgram short-lived token issuance
- Server-recorded, versioned voice-processing acknowledgment required before token issuance
- Public/demo session and booking policy gate
- Stedi secret-bearing requests
- Central privileged/provider tool dispatcher
- Sanitized application security-event sink for decision metadata only; no PHI payloads
- Messaging, telephony, webhooks, and background jobs when added
- Organization/service credentials

The gateway is a security and orchestration boundary, not another source of clinical truth.

## Provider authority

| Layer | May provide | Never decides |
| --- | --- | --- |
| OnePractice | typed intents, policy results, workflow transitions, exception routing, UI | clinical facts or payer responses |
| Medplum | durable FHIR patient, clinical, scheduling, workflow, eligibility projection, lineage | live external payer processing result |
| Stedi | timestamped payer/clearinghouse response | coverage guarantee, coding, medical necessity, price certainty |
| Deepgram | speech, Think/LLM output, function-call proposal, agent events | identity, authorization, workflow transition, clinical/financial action |

Medplum is the application source of truth and the only patient-data retrieval layer in this build. Stedi owns its external transaction response; Medplum stores a timestamped normalized projection and source identifier. Do not add a semantic index until exact scoped Medplum queries have a measured limitation.

## First-slice resource graph

| State | FHIR resources |
| --- | --- |
| OneCare Clinic / Dr. Maya Chen / payer | practice and payer `Organization`, `Practitioner`, `PractitionerRole` |
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
  -> eligibility
  -> needs-attention  # required insurance member ID missing
  -> follow-up response
  -> ready            # original Task completed
```

Separate terminal/safety states: `stopped`, `provider-failure`, `cancelled`.

Canonical readiness rule:

> A visit is Ready only when every v1 required field is present, the booking is current, the eligibility check has a visible returned/not-returned/not-checked state, and no required-field `Task` remains open.

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

- Stable demo identifiers use `onepractice|demo-v1:<resource>:<logical-key>`.
- Slot search and booking use the scheduling adapter; a race returns `SlotConflict` and offers a new slot.
- Repeated function IDs do not authorize or deduplicate anything; OnePractice idempotency keys do.
- Independent reads may run concurrently. Dependent mutations never run based on LLM array order.
- Approval re-reads sources and verifies base versions. Stale proposals require rebase/review.
- Accepted multi-resource mutations use an atomic FHIR transaction where supported.

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
