# VibeDoc UI and Interaction Specification

> Normative priority: subordinate to `AGENTS.md`, `HACKATHON.md`, `CLINIC.md`, and `ARCHITECTURE.md`.

## Design thesis

VibeDoc has two deliberately different surfaces:

- **Patient access:** calm, high-clarity, mobile-first, and one task at a time.
- **Physician cockpit:** dark, dense, keyboard-first, and inspired by Cursor's agent/review workflow.

The shared interaction is the **Ready Visit Rail**:

```text
Request -> Appointment -> Intake -> Coverage response -> Needs attention -> Ready
```

The product should feel fast and intelligent because state changes are immediate, sources are visible, and exceptions are precise—not because animated agents make invisible decisions.

## Information architecture

```text
Public
├── Landing page
├── Talk/type with front desk
└── Synthetic demo access

Patient portal
├── Home / next appointment
├── Intake forms
├── Appointment details
├── Coverage response
└── Administrative assistant

Physician workspace
├── Tomorrow
├── Exceptions
├── Ready-visit workspace
├── Resource/provenance inspector
└── Encounter review — roadmap
```

Never place the patient and physician experiences behind the same generic chat interface.

## Public landing page

### Hero

Display `VibeDoc` as the product/clinic brand and `Powered by Medplum` as the endorsement on every public, patient, and physician surface.

> One call. One ready visit.
>
> Schedule, complete intake, and arrive prepared.

Primary actions:

- `Talk to the front desk`
- `Type instead`
- `Synthetic demo access`

Use a single voice orb as a restrained accent. Opening it reveals a large conversation sheet with:

- explicit automated-assistant disclosure;
- microphone/listening/speaking state;
- live transcript and typed alternative;
- current Ready Visit Rail step;
- appointment cards;
- `Stop microphone` and `Switch to typing` controls;
- final review before booking.

Before opening a provider connection or capturing audio, present the applicable disclosure and require affirmative consent to microphone capture and third-party voice processing. Browser microphone permission is a separate device control, not consent. State the demo retention behavior and provide immediate stop/revoke; declining continues by typing without issuing a Deepgram token.

The assistant describes its scope as scheduling, forms, coverage-response collection, and administrative questions. Never use “Ask me anything.” If symptoms are entered, it stops the routine flow and hands off without assessing severity, suggesting a visit type, diagnosing, reassuring, or recommending care.

When Deepgram is unavailable, show `Voice unavailable — continue by typing`. Typed input continues through the deterministic adapter without waiting for a reconnect. A compact source label distinguishes `Live voice`, `Prerecorded replay`, and `Deterministic fixture`.

## Synthetic demo access

Username-only access is allowed solely as a hackathon shortcut:

- Label it `Synthetic Demo Access`, not login or passwordless authentication.
- Accept only allowlisted fictional usernames such as `maria-demo`.
- Show a persistent `DEMO · SYNTHETIC DATA` banner.
- Do not create an account from arbitrary input.
- Do not reveal user-entered or real patient information.
- Keep patient and clinician demo personas on distinct routes.
- Issue new server-side role-bound sessions for public booking, patient demo, and physician demo; navigation cannot promote an existing session.
- Reset sessions and data deterministically.

Production authentication requires verified control of a channel or authenticator, such as a one-time link/code or passkey, plus secure sessions, expiry, recovery, audit, authorization, and step-up verification for sensitive actions.

## Patient dashboard

Use a quiet neutral canvas, high-contrast typography, restrained cards, generous spacing, and a dominant next-visit card. The accent palette remains intentionally unfrozen until one of the generated direction studies is approved:

```text
Tuesday, August 4 · 10:30 AM
Dr. Maya Chen · Adult annual-wellness visit

Visit readiness: Ready

✓ Appointment booked
✓ Contact details received
✓ Coverage response received
✓ Insurance member ID received

[View visit]
```

During the demo this card first displays `Needs attention` and `Insurance member ID required`. After the patient supplies the synthetic ID, eligibility runs, the original Task completes, and the card changes to Ready. Never display Ready with an open required-field Task.

Below the card:

- appointment details;
- submitted intake and consent;
- coverage response;
- eligibility request/response evidence in the technical inspector;
- administrative messages;
- talk/type with the administrative assistant.

“Check all my information” means a scoped view of appointments, patient-submitted intake, coverage responses, forms, and administrative messages. Do not expose a raw clinical chart in v1.

Coverage vocabulary:

- `Response received`
- `Returned by payer`
- `Not returned`
- `Unknown / not checked`

Never use a green success state for `Covered`, `In network`, `Insurance verified`, `No authorization required`, or guaranteed patient cost.

## Physician cockpit

Use a desktop-first graphite workspace for Dr. Maya Chen with three panes:

```text
┌ Tomorrow / Exceptions ┐ ┌ Ready-visit workspace ┐ ┌ Evidence inspector ┐
│ 9:30  Maria Lopez  ✓  │ │ Appointment            │ │ Source timestamps   │
│ Exceptions (0)        │ │ Intake                 │ │ Provenance          │
│ +1 after safety replay│ │ Coverage               │ │ Policy decision     │
└───────────────────────┘ └────────────────────────┘ └─────────────────────┘
```

Cursor-inspired behavior:

- `Cmd/Ctrl+K`: command palette
- `J/K`: move through appointments
- `E`: open exception queue
- `Enter`: inspect selected visit
- collapsible evidence panel;
- tabs for active work contexts;
- monospace resource IDs, versions, timestamps, and source metadata;
- patch/diff presentation for future clinical proposals;
- compact/balanced/detailed evidence density;
- explicit accept/edit/reject actions rather than invisible auto-apply.

## Function-call trace interaction

After an assistant message invokes tools, show a compact trace group directly beneath it. Each row contains a status indicator, human-readable function name, short safe summary, duration when known, and chevron. Clicking a row opens an inline disclosure or side drawer with:

- allowlisted input fields;
- output placeholder while running;
- output values updating in place as provider/tool events arrive;
- queued, running, awaiting-confirmation, reconciling, completed, failed, cancelled, or blocked state;
- safe timestamps, fixture/live label, and retry state.

The response updates the original request row; it does not create a disconnected duplicate. Read calls may appear concurrently. Dependent writes remain visibly sequential. A mutation with an ambiguous transport result displays `Reconciling with Medplum` and is never shown as failed or retried until its idempotency identifier and committed lineage are checked. On mobile, use an inline sheet; in the physician cockpit, use the evidence drawer. Public/patient views use friendly names and omit internal resource IDs. Physician-demo traces may show allowlisted synthetic resource references and versions.

Never expose credentials, authorization headers, hidden prompts, chain-of-thought, `thought_signature`, raw provider payloads, stack traces, unrestricted FHIR resources, raw audio, or full transcripts. A trace explains execution; it is not Medplum truth, Provenance, or an access audit. See `TRACING.md`.

A persistent MVP context bar displays patient name, second identifier, appointment, readiness, and provider-source mode. Encounter and recording controls remain hidden until that roadmap feature is built. The next patient may be suggested, but `Open visit` and two-identifier confirmation are required before establishing any future write or recording context.

## Exception inbox

Make exceptions a first-class queue. Each row shows:

- workflow category;
- patient when identity is established, otherwise a non-PHI session/caller label;
- owner;
- due time;
- acknowledgment state;
- reason automation stopped;
- one clear next action.

Initial categories are identity, scheduling, intake, coverage, clinical-language handoff, and provider failure. Do not display clinical urgency classifications because VibeDoc is not performing triage. A symptom-bearing message displays `Clinical content received — not assessed`, creates a `requested`/unacknowledged Task owned by the configured clinical-review queue, shows neutral handoff copy, and promises no response time beyond published service hours. Only an authorized human action may transition it to `accepted`.

The detail view shows what happened, the rule that stopped the workflow, exact sources, safe actions, FHIR Provenance, and a separately labeled sanitized application security event. Never imply that the application event is Medplum access audit.

## Encounter review roadmap

When the ready-visit slice is deterministic:

1. Confirm patient and recording consent.
2. Display a highly visible recording bar and stop control.
3. Lock patient, appointment, and encounter context.
4. Render interim transcript differently from finalized transcript.
5. Show speaker labels and timestamps.
6. Place proposed FHIR changes in the right-hand diff pane.
7. Show the exact source excerpt beside every proposal.
8. Accept, edit, or reject each proposal independently.
9. Do not provide `Accept all` for clinical mutations.
10. Invalidate stale proposals when source-resource versions change.

Deepgram is implementation detail. The user-facing action is `Start recording`, not `Talk to Deepgram`.

## Medication evidence roadmap

When clinical chat is built, “Can I consider amoxicillin?” opens an evidence card rather than returning a yes/no chat answer. The card displays:

- exact normalized product/ingredients and identity-match confidence;
- versioned Medplum facts used, separated by chart-confirmed and patient-reported state;
- missing or stale patient data;
- deterministic alerts and the validated knowledge source behind each;
- DailyMed passages with section, `setId`, label version/effective date, and current/archived status;
- checks performed and checks unavailable;
- `Review only` status, with no “Safe,” “Accept all,” dose selection, or automatic prescription action.

Moss may accelerate public-label passage retrieval, but no Moss similarity score appears as a clinical warning. Stale, missing, or unverified sources render a visible unavailable state.

## Visual system

### Patient surface

- Quiet neutral background and high-contrast text
- One approved accent family after visual-direction review
- Completion and attention states use icon, label, and shape in addition to color
- Red only for a stopped or failed workflow
- Rounded 16–20px cards
- Large touch targets and limited simultaneous choices
- Gentle motion with reduced-motion support

### Physician surface

- Dark or high-contrast workspace derived from the approved visual direction
- Layered panels with subtle one-pixel borders
- One shared focus/accent color from the approved direction
- Attention state distinct from destructive/failure state
- Red only for actual stop/failure states
- Compact typography and square controls
- Monospace only for technical metadata

Both surfaces share the logo, Ready Visit Rail, status vocabulary, and source/provenance iconography.

Generated palette explorations live in `design/variants/`. No palette is implementation-approved until the user selects one or requests a blend.

## Accessibility and privacy

- WCAG AA contrast
- Complete keyboard operation and visible focus
- 44×44px minimum patient-facing targets
- No status communicated by color alone
- Captions/transcript for audio
- Typed alternative at every voice step
- Reduced-motion support
- Screen-reader labels for listening, thinking, and speaking
- Just-in-time microphone permission
- Persistent recording indicator and immediate stop
- Mobile-first patient portal
- Session timeout and deliberate re-entry
- No PHI in URLs, logs, analytics, notifications, or public/shared displays

## Patterns to avoid

- One generic AI chat for both administrative and clinical work
- Username-only access that appears production-ready
- Voice-only navigation
- Silent microphone activation
- Automatic patient selection when an appointment starts
- Green payer-guarantee checkmarks
- Transcript text styled like approved chart facts
- Hidden sources or timestamps
- Animated agent swarms
- A polished summary that merges patient report, inference, payer data, and approved facts
- AI-generated emergency-warning classification

## Three-minute UI storyboard

1. **0:00–0:15:** Landing page and Ready Visit Rail establish the promise.
2. **0:15–0:55:** Synthetic patient talks or types; the assistant discloses automation, offers two policy-approved slots, books one, then expands one sanitized `Book appointment` trace row for 5–8 seconds before closing it.
3. **0:55–1:15:** Synthetic Demo Access opens the patient dashboard. The insurance member ID is missing, eligibility is `Not checked`, and the rail shows Needs attention.
4. **1:15–1:40:** The in-app follow-up requests the synthetic member ID; the patient supplies it, eligibility runs, the same Task completes, and the rail advances to Ready.
5. **1:40–2:20:** Switch to the dark physician cockpit; show the Ready visit and Medplum evidence pane.
6. **2:20–2:40:** An uncertain-identity replay reveals no information and creates one new `requested`/unacknowledged exception for the separate session.
7. **2:40–3:00:** Return to the cockpit, show the new exception count and explicit `Acknowledge` action, then expand the Ready visit evidence pane to show `Appointment`, `QuestionnaireResponse`, `Coverage`, `CoverageEligibilityRequest`, `CoverageEligibilityResponse`, completed `Task`, `CommunicationRequest`, delivered `Communication`, and `Provenance`.

Rehearse with the live trace stream unavailable: the same sequence uses labeled deterministic trace fixtures and still completes under three minutes.
