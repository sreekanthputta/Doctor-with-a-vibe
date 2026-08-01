# OnePractice UI and Interaction Specification

## Design thesis

OnePractice has two deliberately different surfaces:

- **Patient access:** warm, calm, mobile-first, and one task at a time.
- **Physician cockpit:** dark, dense, keyboard-first, and inspired by Cursor's agent/review workflow.

The shared interaction is the **Ready Visit Rail**:

```text
Request -> Appointment -> Intake -> Coverage response -> Ready
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

The assistant describes its scope as scheduling, forms, coverage-response collection, and administrative questions. Never use “Ask me anything.” If symptoms are entered, it stops the routine flow and hands off without assessing severity, suggesting a visit type, diagnosing, reassuring, or recommending care.

## Synthetic demo access

Username-only access is allowed solely as a hackathon shortcut:

- Label it `Synthetic Demo Access`, not login or passwordless authentication.
- Accept only allowlisted fictional usernames such as `alex-demo`.
- Show a persistent `DEMO · SYNTHETIC DATA` banner.
- Do not create an account from arbitrary input.
- Do not reveal user-entered or real patient information.
- Keep patient and clinician demo personas on distinct routes.
- Reset sessions and data deterministically.

Production authentication requires verified control of a channel or authenticator, such as a one-time link/code or passkey, plus secure sessions, expiry, recovery, audit, authorization, and step-up verification for sensitive actions.

## Patient dashboard

Use a warm ivory canvas, deep-ink typography, soft cards, generous spacing, and a dominant next-visit card:

```text
Tuesday, August 4 · 10:30 AM
Dr. Maya Chen · Routine new-patient visit

Visit readiness: 3 of 4 complete

✓ Appointment booked
✓ Contact details received
✓ Coverage response received
! Medication list still needed

[Complete intake]
```

Below the card:

- appointment details;
- submitted intake and consent;
- coverage response;
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

Use a desktop-first graphite workspace with three panes:

```text
┌ Tomorrow / Exceptions ┐ ┌ Ready-visit workspace ┐ ┌ Evidence inspector ┐
│ 9:00  Jordan Lee   ✓  │ │ Identity               │ │ FHIR resources      │
│ 9:30  Alex Rivera  1  │ │ Appointment            │ │ Source timestamps   │
│ 10:00 Sam Patel    ✓  │ │ Intake                 │ │ Provenance          │
│                       │ │ Coverage                │ │ Policy decision     │
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

A persistent context bar displays patient name, second identifier, appointment, encounter status, and recording state. The next patient may be suggested, but `Open visit` and two-identifier confirmation are required before establishing a write or recording context.

## Exception inbox

Make exceptions a first-class queue. Each row shows:

- administrative category;
- patient;
- owner;
- due time;
- acknowledgment state;
- reason automation stopped;
- one clear next action.

Initial categories are identity, scheduling, intake, coverage, and provider failure. Do not display clinical urgency classifications because OnePractice is not performing triage.

The detail view shows what happened, the rule that stopped the workflow, exact sources, safe actions, and the resulting audit/provenance state.

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

## Visual system

### Patient surface

- Warm ivory background
- Deep ink text
- Sage for completed administrative progress
- Amber for incomplete work
- Red only for a stopped or failed workflow
- Rounded 16–20px cards
- Large touch targets and limited simultaneous choices
- Gentle motion with reduced-motion support

### Physician surface

- Graphite background
- Slate panels with subtle one-pixel borders
- Teal focus and selection
- Amber exception state
- Red only for actual stop/failure states
- Compact typography and square controls
- Monospace only for technical metadata

Both surfaces share the logo, Ready Visit Rail, status vocabulary, and source/provenance iconography.

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
2. **0:15–0:55:** Synthetic patient talks or types; the assistant discloses automation, offers two policy-approved slots, and books one.
3. **0:55–1:20:** Synthetic Demo Access opens the patient dashboard. Eligibility is timestamped; one intake field is omitted.
4. **1:20–1:45:** The rail stops at intake and shows the follow-up preview plus one owned `Task`.
5. **1:45–2:20:** Switch to the dark physician cockpit; show the ready-visit card, exception, and Medplum evidence pane.
6. **2:20–2:40:** An uncertain-identity replay reveals no information and creates an acknowledged exception.
7. **2:40–3:00:** Expand the evidence pane to show `Appointment`, `QuestionnaireResponse`, `Coverage`, `Task`, `Communication`, and `Provenance`.
