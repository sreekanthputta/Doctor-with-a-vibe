# VibeDoc — Hackathon Build Brief

> Normative priority: subordinate only to `AGENTS.md`; this file is the release and demo contract.

> One request. One ready visit. One physician exception inbox.

Event: YC x Medplum Agentic Healthcare Hackathon

Date: August 1, 2026

Deadline: 5:00 PM Pacific

## Decision

Build **VibeDoc — Powered by Medplum**, a fictional virtual-first adult primary-care microclinic operated by one family physician without dedicated administrative staff. It completes routine front-office workflows and routes only exceptions to Dr. Maya Chen.

Do not pitch “replace everyone in a hospital.” Pitch:

> **A front office in software; humans handle clinical care and exceptions.**

Long-term framing: **One physician runs an AI-native, virtual-first adult primary-care microclinic without dedicated administrative staff.** Do not claim that one person runs a hospital or that external laboratories, imaging facilities, pharmacies, specialists, urgent care, and emergency departments have no human teams. See `CLINIC.md`.

The north star is a Cursor-like cockpit for the entire clinic. The winning one-day wedge is narrower: **one patient request becomes one ready visit without staff re-entering the patient's information**. See `UI.md` for the exact patient and physician surfaces.

## Platform architecture

```text
Browser voice ----> optional Deepgram Voice Agent --┐
Typed web --------> live Deepgram or scripted bypass ├─> VibeDoc
Future phone/SMS -> PSTN/messaging adapter ----------┘   workflow brain + UX
                 |                 |
                 v                 v
             Medplum             Stedi
       clinical/workflow       payer network
         source of truth   transaction authority
```

VibeDoc owns policy, sequencing, authorization, approval, idempotency, and exception routing. No vendor independently decides a clinical or financial action. Medplum remains authoritative for patient/clinical/workflow state and supports exact scoped retrieval. Stedi is authoritative for its current payer transaction and is synchronized into Medplum. Deepgram provides conversational speech, Think/LLM output, and function-call proposals; every output is untrusted and has no workflow authority. Moss is not part of the administrative MVP; a future clinical-support experiment may index only public, versioned medication-label evidence.

The demo deploys as one Railway service. Assistant messages show compact function rows whose sanitized inputs, outputs, and status update in real time. This makes sponsor integrations and deterministic fallback visible without exposing secrets, hidden reasoning, raw provider payloads, or unrestricted FHIR content.

The workflow brain is deterministic around the model:

```text
channel adapter
  -> identity/session gate
  -> schema-validated intent
  -> versioned practice-policy engine
  -> deterministic workflow state machine
  -> scoped provider adapter
  -> centralized FHIR mutation service
  -> provenance + sanitized application security event
```

The model may propose a typed intent or draft copy. It never owns workflow state transitions, patient identity, permission decisions, retries, or arbitrary provider/FHIR tools.

## Why this concept

“AI receptionist” and “all-in-one EHR” are crowded categories. The differentiated product is a Medplum-native operational graph:

```text
patient intent
  -> published practice rule
  -> completed routine actions
  -> structured Medplum state
  -> one owned exception inbox
  -> physician approval only where judgment is required
```

It demonstrates why healthcare benefits from an agent without pretending the model can practice medicine. The initial buyer is an owner-family-physician operating a new adult primary-care microclinic; later expansion may support other outpatient practices.

## Exact three-minute demo

### 0:00–0:20 — The promise

Start on the public landing page. Keep the physician cockpit pre-opened in a separate browser profile/context for the later reveal; different roles never share one cookie jar. Do not spend opening time explaining session mechanics.

> “Independent doctors spend their day operating software and chasing paperwork. VibeDoc makes the routine work disappear and shows only exceptions.”

### 0:20–1:10 — Patient front door

A scripted synthetic patient, Maria Lopez, says or types:

> “I’m a new patient. I want an annual wellness visit next Tuesday morning and I have Aetna.”

The assistant:

1. Identifies itself as automated and obtains an explicit synthetic-demo recording acknowledgment before audio capture.
2. Verifies only the minimum synthetic identity fields.
3. Offers slots allowed by a visible, physician-authored policy.
4. Books one appointment through the scheduling adapter.
5. Captures coverage information and sends a short intake questionnaire.

Immediately after booking, expand exactly one compact `Book appointment` trace row for 5–8 seconds. Show its sanitized input, live/fixture label, completed state, and Medplum `Appointment` reference, then close it. Do not open raw payloads or narrate implementation details.

For reliability, deterministic typed input uses `ScriptedConversationAdapter`. Live browser voice or typed agent-chat can use Deepgram through the same domain intent schema. A real phone number is roadmap, not an optional stage flourish.

### 1:10–1:45 — Ready-visit loop

The patient enters **Synthetic Demo Access** and opens the fixed fictional persona. A typed demo username is a persona selector, not authentication, and never exposes real data. Production replaces this with a verified one-time link/code, passkey, or equivalent identity proof.

The patient submits all currently available intake answers but has not supplied the synthetic insurance member ID required by the physician-authored demo readiness policy. The `QuestionnaireResponse` remains `in-progress`. VibeDoc:

- marks the `QuestionnaireResponse` as patient-reported;
- delivers a privacy-minimal in-app follow-up message and records the actual event;
- creates one owned administrative `Task` for the unresolved field;
- shows eligibility transaction `Not run` until the required identifier exists.

The patient supplies `AETNA-DEMO-2048`. VibeDoc completes the validated `QuestionnaireResponse`, updates `Coverage`, runs the deterministic labeled eligibility fixture (or live approved test adapter), stores the request/response projection, completes the same idempotent Task, and advances `Needs attention -> Ready`. A visit with any required open Task remains Needs attention.

It never translates eligibility into “covered,” “in network,” “no authorization required,” or a price guarantee.

Eligibility transaction state is separate from missing benefit fields. Before the member ID, no eligibility adapter is called. Ready requires a persisted linked request/response with the configured completed outcome and fixture/live source identifier. If live eligibility fails, the labeled fixture may run; if neither produces valid persisted evidence, the original Task stays open and the visit remains Needs attention. Individual fields may still display `Not returned` or `Unknown / not checked`.

### 1:45–2:25 — Physician cockpit

The “Tomorrow” queue now contains the Ready appointment. Opening it shows:

- appointment and identity summary;
- completed intake fields and the resolved follow-up history;
- coverage source and timestamp;
- exact underlying Medplum resources;
- no open required-field exception on the Ready visit.

The current patient is suggested, never silently selected for a recording or write. A future encounter begins only after the physician confirms two identifiers and locks `Patient + Appointment + Encounter` context.

### 2:25–2:45 — Trust proof

Replay one deterministic unsafe case on stage: uncertain identity. The system stops the routine automation, reveals no PHI, provides no clinical disposition, and creates an owned `requested`/unacknowledged exception with a visible human `Acknowledge` action. This exception is not attached to the Ready patient unless identity is later resolved by an authorized human. The clinical-language stop fixture and fixed non-personalized safety copy remain automated acceptance evidence and a backup demo, not a second staged exception.

### 2:45–3:00 — Platform reveal

Show the Medplum graph and provenance:

> “Today: one request becomes one ready visit. Next: the same governed operations layer handles referral packets, result follow-up, claim status, and a clinician-reviewed encounter draft.”

Dashboard proof: **one routine request completed, zero staff re-entry, one exception surfaced**. These are demo counts, not unmeasured customer savings.

## UI contract

The patient surface is calm, high-clarity, mobile-first, and one task at a time. The physician surface uses a dark, calm, Cursor-inspired three-pane layout. The final palette is selected from the canonical visual studies before tokens freeze:

| Pane | Contents |
| --- | --- |
| Left | Today/Tomorrow appointments and exception count |
| Center | Conversation or encounter timeline with source markers |
| Right | Ready-visit state, proposed changes, FHIR resources, approve/reject controls |

The interface must distinguish:

| State | Example | Authority |
| --- | --- | --- |
| Patient-reported | Medication name typed in intake | Unverified source statement |
| Existing chart fact | Active allergy in Medplum | Current versioned FHIR record |
| Transcript | Finalized speaker segment | Source artifact, not a fact |
| Agent inference | Possible structured field | Validated draft only |
| Practice rule | Routine visit lead time | Published owner configuration |
| Payer response | Returned eligibility field | Timestamped test/provider data |
| Physician decision | Accepted correction/referral | Accountable clinical action |

Never collapse these states into one polished paragraph.

## Medplum resource graph

| Workflow state | FHIR resource |
| --- | --- |
| Patient and authorized proxy | `Patient`, `RelatedPerson` |
| Bookable service/availability | `HealthcareService`, `Schedule`, `Slot` |
| Administrative booking | `Appointment` |
| Insurance supplied by patient | `Coverage` |
| Eligibility projection | `CoverageEligibilityRequest`, `CoverageEligibilityResponse` |
| Intake template and answers | `Questionnaire`, `QuestionnaireResponse` |
| Missing field / exception / fulfillment | `Task` |
| Follow-up intent and actual delivery | `CommunicationRequest`; `Communication` only after the in-app message is displayed/delivered |
| Permission/recording choice | `Consent` where appropriate |
| Lineage of committed changes | `Provenance`; server access in audit trail |

Medplum scheduling is beta. Isolate `$find/$hold/$book/$confirm/$cancel` behind a typed adapter and keep a deterministic fixture.

## Encounter and clinician-chat roadmap

After the front-door slice is reliable:

1. Physician explicitly starts a seeded encounter and confirms two patient identifiers.
2. The app visibly locks patient/appointment/encounter context.
3. Consented audio goes through a server-side Deepgram gateway; interim text is display-only.
4. Final speaker-attributed transcript becomes a source `DocumentReference`; raw audio retention is policy-controlled.
5. Extraction returns a strict typed proposal, never direct FHIR writes.
6. The physician sees a source-linked diff and accepts, edits, or rejects each item.
7. Accepted resources use current version checks and the conservative `post-commit-versioned` Provenance mode; the UI shows committed state and lineage confirmation separately and never calls them atomic.

Clinical chat is roadmap-only and is not shown in the judged demo. When built, a question such as “Can I suggest paracetamol?” may retrieve active medications, allergies, relevant history, missing data, and authoritative source links; it must not choose treatment. The physician independently reviews the basis and decides.

A referral begins as a proposal. After physician approval, create a `ServiceRequest`; track fulfillment separately with `Task`, supporting documents, and `Communication`. Transmission alone does not close the loop.

## Provider boundaries

- **Medplum:** only required live dependency; system of record and workflow backbone.
- **Deepgram Voice Agent:** optional live front-desk voice and typed-agent-chat adapter; typed turns can use `InjectUserMessage`, but deterministic typed fallback bypasses Deepgram.
- **Deepgram Nova streaming/batch:** future encounter transcription with diarization and finalized segments.
- **Stedi:** optional test eligibility adapter; show only returned fields.
- **Search:** use exact, authorization-scoped Medplum queries for all patient facts. A future Moss experiment may retrieve public medication-label passages only after benchmarks show a material latency/context advantage; it cannot become the interaction engine or source of patient truth.
- **Messaging/PSTN/model:** fixture-first, disabled without breaking the demo.

Provider secrets remain server-side. Browser voice requires a short-lived token from a minimal backend; permanent Deepgram or Stedi keys never enter client JavaScript. Never send real PHI during the hackathon. Deepgram entity-level PHI redaction must not be assumed for the conversational path.

## MVP acceptance criteria

- One synthetic new-patient path creates Maria and completes from request to ready-visit card.
- Medplum visibly stores the appointment, intake response, coverage, eligibility request/response projection, completed Task, follow-up `CommunicationRequest`, actually delivered in-app `Communication`, and Provenance.
- The inspector separately shows one sanitized application security event (`eventId`, timestamp, actor role, action class, decision, correlation ID, fixture/live label; no payload/PHI). It is never represented as FHIR `Provenance` or claimed to be Medplum access audit.
- Wrong or uncertain identity reveals no PHI.
- Slot conflict retries without double-booking.
- Missing insurance member ID creates exactly one idempotent Task; supplying it updates `Coverage`, records eligibility evidence, and completes that Task before Ready.
- Missing payer values remain `unknown/not checked`.
- Eligibility is never invoked before the member ID; a missing, failed, malformed, or partially persisted transaction keeps Needs attention even though individual benefit fields may be unknown.
- Two-tab/retry Maria creation produces one Patient/workflow; near matches and forged identifiers bind no patient and create one exception.
- Every symptom/mixed-language fixture displays the exact fixed safety copy, reveals no PHI, and performs no scheduling mutation.
- The staged reset ends with exactly one active exception: the uncertain-identity Task. Clinical-language fixtures run in isolated tests/backup replay and do not alter the staged count.
- All external calls have deterministic fixtures.
- One compact booking trace expands, updates in place, and shows only a role/session/subject-authorized sanitized projection; the Ready path still completes if the live trace stream is unavailable.
- Reset and rerun produce no duplicate resources.
- The full story is rehearsed in under three minutes.
- In a five-person recall check after one viewing, at least four people can state the buyer, patient request, Ready outcome, Medplum's role, and the safe identity stop.

## Build order

1. Scaffold and freeze test commands, typed contracts, stable identifiers, four route shells, trace schemas, deterministic fixtures, and exclusive paths; freeze color values only after visual-direction approval.
2. Write positive/negative contract tests and the failing critical browser skeleton.
3. Launch isolated domain, FHIR, and fixture-driven UI worktrees. Each records RED before implementation and hands off only GREEN commits.
4. Integrate the Deepgram-independent typed patient conversation, practice seed, Maria creation, appointment/intake graph, incomplete-field Task, Ready derivation, four shells, and fixture traces.
5. Add hosted Medplum transport, provenance, idempotency, version checks, seed/reset, slot conflict, and response-loss reconciliation.
6. Add server session isolation, trace redaction/SSE, Railway lifecycle, outage, and browser safety tests.
7. Put Stedi and Deepgram behind separately owned optional adapters only after the fixture slice is green.
8. Run the reviewer council, resolve all CRITICAL/HIGH findings, explicitly record accepted MEDIUM risks, freeze, and rehearse.

## Scope cuts

Do not build in v1:

- autonomous symptom triage or clinical disposition;
- medication or treatment recommendations;
- live e-prescribing, labs, claims, prior authorization, or external referral transmission;
- arbitrary chart writes from chat or transcripts;
- general workflow builder or multi-agent animation;
- multiple clinics, specialties, visit types, or payer scenarios;
- raw audio retention or real patient data.
- username-only access to any real or user-entered patient information.

## Sponsor questions

Ask only questions that change the build:

1. Is patient-facing voice required for judging, or is it one possible interface?
2. Will the hosted project support the documented scheduling beta operations during judging, and which status/participant pattern do you recommend?
3. Should appointment creation use `$hold` then `$confirm`, or is `$book` the preferred hackathon path?
4. What is the preferred Medplum pattern for AI proposals awaiting review: in-progress `QuestionnaireResponse` plus `Task`, or app state until approval?
5. Can one FHIR transaction commit accepted resources, complete the review `Task`, and create `Provenance` atomically in the hosted project?
6. Which audit events can the demo user query or display?
7. Does a Stedi test-mode eligibility transaction qualify for sponsor judging, and which response fixture is approved?
8. Must a sponsor integration be live on stage, or is a recorded, timestamped fixture acceptable as fallback?
9. What are the judging weights for real end-to-end function, Medplum depth, novelty, safety, and startup potential?
10. Are there constraints on external speech/model providers, BAAs, recording, or synthetic calls during the event?
11. Can Speak/TTS be disabled for an injected typed turn, and if not, is muted output still billed as TTS?

## Sources

- [Research, alternatives, role boundaries, and evidence](./RESEARCH.md)
- [Medplum scheduling](https://www.medplum.com/docs/scheduling)
- [Medplum appointment booking](https://www.medplum.com/docs/scheduling/appointment-book)
- [Medplum intake and registration](https://www.medplum.com/docs/intake)
- [Medplum charting](https://www.medplum.com/docs/charting)
- [Medplum referral management](https://www.medplum.com/docs/careplans/referrals)
- [Medplum AI guidance](https://www.medplum.com/docs/ai)
- [FDA Clinical Decision Support Software guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software)
- [AAFP family medicine](https://www.aafp.org/about/family-medicine)
- [Deepgram Voice Agent Browser SDK](https://developers.deepgram.com/docs/browser-agent-overview)
- [Deepgram Inject User](https://developers.deepgram.com/docs/voice-agent-inject-user-message)
- [Deepgram function-call request](https://developers.deepgram.com/docs/voice-agent-function-call-request)
- [Deepgram diarization](https://developers.deepgram.com/docs/diarization)
- [FHIR R4 CoverageEligibilityRequest](https://hl7.org/fhir/R4/coverageeligibilityrequest.html)
- [FHIR R4 CoverageEligibilityResponse](https://hl7.org/fhir/R4/coverageeligibilityresponse.html)
- [FHIR R4 QuestionnaireResponse](https://hl7.org/fhir/R4/questionnaireresponse.html)
- [FHIR R4 Communication](https://hl7.org/fhir/R4/communication.html)
