# OnePractice — Hackathon Build Brief

> One call. One ready visit. One physician exception inbox.

Event: YC x Medplum Agentic Healthcare Hackathon

Date: August 1, 2026

Deadline: 5:00 PM Pacific

## Decision

Build **OnePractice**, a FHIR-native operations layer for a new independent outpatient practice. It completes routine front-office workflows and routes only exceptions to the physician.

Do not pitch “replace everyone in a hospital.” Pitch:

> **A front office in software; humans handle clinical care and exceptions.**

The north star is a Cursor-like cockpit for the entire clinic. The winning one-day wedge is narrower: **one call becomes one ready visit without manual re-entry**. See `UI.md` for the exact patient and physician surfaces.

## Platform architecture

```text
Phone / website / SMS
          |
          v
Deepgram voice transport
          |
          v
OnePractice workflow brain and user experience
       |              |              |
       v              v              v
   Medplum          Moss           Stedi
clinical/workflow  derived search  payer network
source of truth    accelerator     transaction authority
```

OnePractice owns policy, sequencing, approval, idempotency, and exception routing. No vendor independently decides a clinical or financial action. Medplum remains authoritative for patient/clinical/workflow state. Stedi is authoritative for the current payer transaction and is synchronized into Medplum. Moss is rebuildable and must never become an access-control or clinical-fact source. Deepgram supplies audio transport and transcription, not reasoning.

The workflow brain is deterministic around the model:

```text
channel adapter
  -> identity/session gate
  -> schema-validated intent
  -> versioned practice-policy engine
  -> deterministic workflow state machine
  -> scoped provider adapter
  -> centralized FHIR mutation service
  -> provenance and security audit
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

It demonstrates why healthcare benefits from an agent without pretending the model can practice medicine. The long-term buyer is an owner-physician or practice operator in a new one-to-five-provider outpatient practice.

## Exact three-minute demo

### 0:00–0:20 — The promise

Show an empty “Tomorrow” queue.

> “Independent doctors spend their day operating software and chasing paperwork. OnePractice makes the routine work disappear and shows only exceptions.”

### 0:20–1:10 — Patient front door

A scripted synthetic patient says or types:

> “I’m a new patient. I want a routine visit next Tuesday morning and I have Aetna.”

The assistant:

1. Identifies itself as automated and obtains the demo recording notice if audio is used.
2. Verifies only the minimum synthetic identity fields.
3. Offers slots allowed by a visible, physician-authored policy.
4. Books one appointment through the scheduling adapter.
5. Captures coverage information and sends a short intake questionnaire.

For reliability, the typed conversation and prerecorded audio use the same adapter. Live phone is an optional flourish.

### 1:10–1:45 — Ready-visit loop

The patient completes most of the questionnaire but omits the medication list. OnePractice:

- marks the `QuestionnaireResponse` as patient-reported;
- previews a privacy-minimal follow-up message;
- creates one owned administrative `Task` for the unresolved field;
- shows timestamped Stedi test fields if available, with missing values as `unknown/not checked`.

It never translates eligibility into “covered,” “in network,” “no authorization required,” or a price guarantee.

The patient reopens the fictional visit through **Synthetic Demo Access**. A typed demo username selects a predefined fictional persona; it is not authentication and never exposes real data. Production replaces this with a verified one-time link/code, passkey, or equivalent identity proof.

### 1:45–2:25 — Physician cockpit

The “Tomorrow” queue now contains the appointment. Opening it shows:

- appointment and identity summary;
- completed and missing intake fields;
- coverage source and timestamp;
- exact underlying Medplum resources;
- one exception, one owner, and one next action.

The current patient is suggested, never silently selected for a recording or write. A future encounter begins only after the physician confirms two identifiers and locks `Patient + Appointment + Encounter` context.

### 2:25–2:45 — Trust proof

Show a deterministic unsafe case: uncertain identity, a stale slot, or a phrase requiring clinical escalation. The system stops the routine automation, reveals no PHI, provides no clinical disposition, and creates an acknowledged exception path.

### 2:45–3:00 — Platform reveal

Show the Medplum graph and provenance:

> “Today: one call becomes one ready visit. Next: the same governed operations layer handles referral packets, result follow-up, claim status, and a clinician-reviewed encounter draft.”

Dashboard proof: **one routine call resolved, zero manual re-entry, one exception surfaced**. These are demo counts, not unmeasured customer savings.

## UI contract

Use a dark, calm, Cursor-inspired three-pane layout:

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
| Intake template and answers | `Questionnaire`, `QuestionnaireResponse` |
| Missing field / exception / fulfillment | `Task` |
| Reminder or transmission record | `Communication` |
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
7. Accepted resources and `Provenance` commit atomically with current version checks.

Clinical chat is read-only in the hackathon. For “Can I suggest paracetamol?” it may show active medications, allergies, relevant history, missing data, and authoritative source links. It must not choose treatment. The physician must independently review the basis and decide. “What should I do?” is too broad for an autonomous answer.

A referral begins as a proposal. After physician approval, create a `ServiceRequest`; track fulfillment separately with `Task`, supporting documents, and `Communication`. Transmission alone does not close the loop.

## Provider boundaries

- **Medplum:** only required live dependency; system of record and workflow backbone.
- **Deepgram Flux:** future front-desk conversational turn-taking.
- **Deepgram Nova streaming/batch:** future encounter transcription with diarization and finalized segments.
- **Stedi:** optional test eligibility adapter; show only returned fields.
- **Moss:** optional derived semantic index for approved clinic knowledge and synthetic demo documents; every patient-specific hit must be permission-filtered, re-fetched from Medplum, and version-checked.
- **Messaging/PSTN/model:** fixture-first, disabled without breaking the demo.

Provider secrets remain server-side. Never send real PHI during the hackathon. Deepgram entity-level PHI redaction must not be assumed for Flux.

## MVP acceptance criteria

- One seeded synthetic patient path completes from request to ready-visit card.
- Medplum visibly stores the appointment, intake response, coverage, task, and provenance/audit evidence as appropriate.
- Wrong or uncertain identity reveals no PHI.
- Slot conflict retries without double-booking.
- Missing intake creates exactly one idempotent follow-up task.
- Missing payer values remain `unknown/not checked`.
- All external calls have deterministic fixtures.
- Reset and rerun produce no duplicate resources.
- The full story is rehearsed in under three minutes.

## Build order

1. Seed one physician, service, schedule, patient fixture, questionnaire, and deterministic availability.
2. Define typed conversation intents, policy decisions, provider results, and mutation allowlists.
3. Implement the typed patient conversation and Medplum appointment/intake graph.
4. Add incomplete-field detection and the single exception inbox.
5. Build the Cursor-like three-pane UI around the complete path.
6. Add provenance, idempotency, version checks, seed/reset, and safety fixtures.
7. Put Stedi behind its fixture adapter.
8. Add prerecorded Deepgram input, then live audio only if the demo remains deterministic.
9. Run the reviewer council, resolve all HIGH findings, freeze, and rehearse.

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

## Sources

- [Research, alternatives, role boundaries, and evidence](./RESEARCH.md)
- [Medplum scheduling](https://www.medplum.com/docs/scheduling)
- [Medplum intake and registration](https://www.medplum.com/docs/intake)
- [Medplum charting](https://www.medplum.com/docs/charting)
- [Medplum referral management](https://www.medplum.com/docs/careplans/referrals)
- [Medplum AI guidance](https://www.medplum.com/docs/ai)
- [FDA Clinical Decision Support Software guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software)
- [Deepgram Flux](https://developers.deepgram.com/docs/flux/quickstart)
- [Deepgram diarization](https://developers.deepgram.com/docs/diarization)
