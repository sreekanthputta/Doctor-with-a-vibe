# Deepgram Voice, Chat, and Tool Architecture

Research checked August 1, 2026.

> **Document priority:** `AGENTS.md` → `HACKATHON.md` → `CLINIC.md` → `ARCHITECTURE.md` → this document. If examples here conflict with those files, the higher-priority document wins.

## Decision

When Deepgram is enabled, build live voice and live typed chat on the same role-specific Voice Agent session. Always retain a deterministic typed path that bypasses Deepgram and emits the same validated `AdministrativeIntent` schema.

- Voice input sends microphone audio over the WebSocket.
- Typed input sends `InjectUserMessage`.
- Both inputs use the same Deepgram Think model, prompt, context, function definitions, and tool dispatcher.
- Both render `ConversationText` in the conversation timeline.
- Voice mode plays returned audio. Chat mode mutes or discards playback.
- If token issuance, the WebSocket, model, or TTS fails, typed input continues through `ScriptedConversationAdapter`; it does not wait for Deepgram to reconnect.

Deepgram documents `InjectUserMessage` specifically for chat/text interfaces and says the agent responds as though the user spoke the message. Current documentation does not describe a per-turn pure-text mode that bypasses Speak/TTS. Confirm billing and any supported TTS-disable mechanism with the sponsor; do not assume muted audio avoids TTS cost.

## Session flow

```text
microphone audio ─┐
                  ├─> Deepgram Voice Agent WebSocket
live typed text ──┘        STT -> Think/LLM -> Speak
                                 |
                                 v
                      FunctionCallRequest[]
                                 |
                                 v
                    VibeDoc tool dispatcher
                      |          |          |
                      v          v          v
                    UI/read    Medplum    secure gateway
                      |          |       Stedi/SMS/PSTN
                      └──────────┴──────────┘
                                 |
                                 v
                      FunctionCallResponse
                                 |
                                 v
                   ConversationText + optional audio

typed fallback -> ScriptedConversationAdapter -> AdministrativeIntent
                                      |
                                      v
                         same policy/tool dispatcher
```

Deepgram chooses whether to request a declared function; VibeDoc executes it. Deepgram never receives arbitrary Medplum or Stedi credentials and never becomes the workflow authority.

Every function request and response also emits a sanitized application trace event. The request opens one row; progress and `FunctionCallResponse` update that same row by application `traceId` and provider function ID. Provider IDs are correlation data only, never authorization or idempotency. The trace projection is produced after runtime validation and field allowlisting; raw arguments, hidden prompts, `thought_signature`, provider frames, and unrestricted FHIR responses are never rendered. See `TRACING.md`.

## Typed chat

The wire message is:

```json
{
  "type": "InjectUserMessage",
  "content": "Show me Tuesday morning appointment times"
}
```

Keep one patient-front-desk session state for live voice and live typed chat. Physician context is a separate authenticated roadmap state and can never be reached by upgrading a public session:

```ts
type InteractionMode = 'voice' | 'chat';

interface FrontDeskAgentSessionState {
  mode: InteractionMode;
  connected: boolean;
  sessionId: string;
  messages: ConversationMessage[];
  pendingFunctionCalls: FunctionCall[];
  publicSessionId: string;
}

interface PhysicianSessionState {
  authenticatedUserId: string;
  selectedPatientId?: string;
  lockedEncounterId?: string;
}
```

Switching mode changes microphone and playback behavior, not the agent, tools, or context. Never depend on Deepgram's in-memory conversation as durable workflow state. Persist approved application state in Medplum and reconstruct only the minimum relevant conversation/function history after reconnect.

## Function-call protocol

A `FunctionCallRequest` can contain multiple functions. Each includes an ID, name, JSON-encoded arguments, and `client_side`. Some Think models can include `thought_signature`; preserve it exactly as required by current Deepgram SDK/types.

Deepgram's `client_side` flag means that the application must return the result; it does not mean the operation is trusted or safe to execute directly in a browser. For every application-handled function:

1. Confirm `client_side === true`.
2. Look up the name in the role-specific allowlist.
3. Parse JSON arguments.
4. Validate arguments against a runtime schema.
5. Re-authorize against the current user, tenant, patient, and encounter context.
6. Apply deterministic practice/safety rules.
7. Require explicit UI confirmation when configured.
8. Execute through the correct provider adapter.
9. Validate and minimize the result.
10. Return a `FunctionCallResponse` with the matching ID and name.
11. Record correlation, result class, and mutation provenance without logging PHI payloads.

Unknown tools, invalid JSON, extra properties, stale context, wrong patient, missing confirmation, duplicate calls, and timeouts must fail closed.

```ts
type ToolKind = 'ui' | 'read' | 'draft' | 'commit' | 'external';

interface ToolDefinition<TArgs, TResult> {
  kind: ToolKind;
  schema: Schema<TArgs>;
  execute: (args: TArgs, context: AuthorizedContext) => Promise<TResult>;
  requiresConfirmation: boolean;
  idempotent: boolean;
  allowedRoles: Array<'public-booking' | 'patient-demo' | 'physician-demo' | 'billing-roadmap'>;
}
```

Read-only calls with independent inputs may run concurrently. Dependent writes are executed in a deterministic state machine, not in the array order chosen by the LLM. Never use `Promise.all` for mutations merely because one request contains multiple functions.

## Minimal backend is required

The frontend can contain almost all visible UI, but the application cannot safely be fully client-only.

Deepgram's Browser Agent documentation explicitly says browser applications must never expose API keys and should obtain a short-lived token from a server-side token factory.

Minimum backend surface:

```text
POST /api/deepgram/token
POST /api/tools/public-booking
POST /api/tools/eligibility
POST /api/tools/send-message
POST /api/tools/approved-clinical-action   # roadmap
POST /webhooks/stedi                       # roadmap
POST /webhooks/telephony                   # roadmap
background jobs/reminders                  # roadmap
```

This gateway stores no duplicate clinical database. It protects permanent/service credentials, performs policy enforcement, handles public sessions and callbacks, and supports work that must continue after the browser closes.

The token endpoint must issue least-privilege short-lived credentials, bind requests to an allowed origin and application session, apply rate and abuse limits, and never return the permanent Deepgram key. The server session must contain a timestamped acknowledgment of the displayed voice-processing disclosure (including disclosure version/provider); absent, declined, expired, or revoked acknowledgment returns `403`, while deterministic typing remains available. Confirm the supported token scope and TTL with Deepgram before claiming production readiness.

Revocation is active, not merely prospective: stop the microphone track, clear queued audio/playback, close the Voice Agent WebSocket, invalidate the server session/token where supported, discard unexecuted function proposals, and reject any late frame or function response for that revoked session. The UI then remains in deterministic typed mode.

### Safe browser-side functions

For an authenticated, properly scoped Medplum user:

- navigate/select UI state;
- list that user's allowed appointments;
- read the explicitly selected patient within policy;
- show conditions, allergies, medications, labs, tasks, and sources;
- populate an uncommitted local draft;
- stage a typed proposal;
- request confirmation.

The public patient session is more restricted: browser code may update presentation state and submit validated requests to the gateway, but it may not directly create patients, book appointments, search the organization, run eligibility, or send messages.

### Server-side functions

- Deepgram short-lived token issuance;
- Stedi operations and all payer/claim secrets;
- organization-wide patient search and public registration;
- public booking/identity workflows;
- SMS/email and telephony;
- webhooks and scheduled/background work;
- claim submission/resubmission;
- external referral/order transmission;
- privileged or organizational clinical mutations;
- any action requiring a service account.

## Agent separation

Use separate Deepgram agent configurations, prompts, audit identities, and tool allowlists.

### Patient front desk

Initial tools:

- `search_public_availability`
- `hold_demo_appointment`
- `confirm_demo_appointment`
- `get_intake_form`
- `save_demo_intake`
- `get_demo_coverage_response`
- `create_administrative_exception`
- `show_transfer_instructions`

No clinical chart search, symptom classification, medication advice, ordering, referrals, claims, or organization-wide patient search.

The post-booking `patient-demo` session is separate from `public-booking`. It may read only its fixed fictional persona's appointment, forms, coverage response, Tasks, and messages and may submit the outstanding synthetic member ID through the gateway. It cannot search availability for arbitrary identities, enumerate patients, or invoke physician tools.

### Physician cockpit — roadmap, not the judged workflow

Read/draft roadmap tools:

- `list_my_appointments`
- `open_patient_context`
- `get_patient_summary`
- `get_medications_and_allergies`
- `prepare_medication_evidence_review`
- `get_lab_trends`
- `search_patient_sources`
- `stage_note_changes`
- `draft_lab_order`
- `draft_imaging_order`
- `draft_referral`
- `draft_patient_instructions`

Clinical commit/transmit tools are separate commands and require a locked patient context, explicit reviewed action card, current source versions, an authenticated authorized user, and the correct signature/integration workflow. They are not included in the hackathon demo.

`prepare_medication_evidence_review` is a read-only roadmap orchestrator, not an LLM safety judgment. It normalizes the candidate with RxNorm, obtains exact authorized patient facts from Medplum, runs only configured validated checks, retrieves section-scoped public label evidence through an optional Moss adapter, revalidates the authoritative label/version, and returns structured `alerts`, `missingData`, `checksPerformed`, `checksUnavailable`, and cited `evidence`. Its `allowedAction` is always `review_only`; prescribing remains a separate signed workflow.

### Billing — roadmap, not the judged workflow

- `get_eligibility_response`
- `create_claim_draft`
- `validate_claim_draft`
- `get_claim_status`
- `get_remittance`
- `create_billing_exception`

Submission and resubmission require a production Stedi account, idempotency, supporting signed documentation, and authorized billing review.

Do not create separate agents merely to make an architecture diagram look agentic. A role deserves its own agent only when its data permissions, tools, prompt, or accountable user differs.

## Clinical action model — roadmap appendix

The physician experience is:

```text
Ask -> inspect sources -> edit/review action card -> sign/approve -> transmit -> track
```

Never map a spoken sentence directly to an active clinical resource or external transmission.

| Action | Medplum representation | External completion | Required human gate |
| --- | --- | --- | --- |
| Lab order | `ServiceRequest` | Health Gorilla/direct lab integration | clinician selects and signs |
| Imaging order | `ServiceRequest` | facility FHIR/HL7/API/fax/network | clinician selects and signs |
| Referral | `ServiceRequest` + lifecycle `Task` | directory + FHIR/Direct/API/fax | clinician approves service, priority, destination, packet |
| Prescription | `MedicationRequest`/eRx workflow | DoseSpot or another certified network | approved enrolled prescriber; EPCS controls where applicable |
| Results | `DiagnosticReport` + `Observation` | lab/imaging inbound integration | clinician interprets and acknowledges |
| Note/chart updates | workflow-specific clinical resources + `Provenance` | Medplum transaction | clinician edits/signs each proposal |
| Administrative scheduling | `Appointment` + `Task`/`Communication` | scheduling/messaging adapter | patient-requested routine change or execution of an already signed instruction |
| Clinical follow-up need/interval/type | signed instruction/order plus `Task` | scheduling/messaging adapter | clinician decides and signs before logistics execute |
| Claim draft | `Claim` plus supporting sources | Stedi 837P roadmap | clinician/coder approves signed-record-supported coding |

Creating a FHIR resource does not prove that an external lab, imaging center, pharmacy, payer, or specialist received it. Transmission, acknowledgment, fulfillment, results, and closure are separate states.

Medplum's current Health Gorilla integration is advanced and requires provider organization eligibility, lab accounts/relationships, and implementation setup. Its DoseSpot integration is limited to approved prescribers engaged in patient care and includes identity proofing and EPCS requirements. These cannot be simulated by a generic function call and described as production-ready.

## Action-card UI — roadmap appendix

Every proposed clinical action appears in the physician's right-side diff/review pane:

```text
Proposed actions

1. CBC
   Routine · preferred lab · this week

2. Comprehensive metabolic panel
   Routine · preferred lab · this week

Checks
✓ Patient context explicitly locked
✓ Catalog entries selected
? Fasting instructions not checked
! External transmission not configured in demo

[Edit] [Discard] [Review & sign]
```

Voice can open, fill, or navigate an action card. Signing requires a deliberate authenticated UI interaction that displays the exact final action and sources; it cannot be inferred from conversational assent.

## Demo scope

Deepgram is an optional live enhancement for voice and chat in the ready-visit flow:

1. Browser obtains a short-lived token.
2. Voice or `InjectUserMessage` starts the same administrative session when connected.
3. Deepgram requests only allowlisted ready-visit functions.
4. VibeDoc validates and executes them through deterministic adapters.
5. Medplum remains the only required live backend dependency.
6. Stedi uses a labeled eligibility fixture/test request.
7. If Deepgram is unavailable, typed input immediately uses the deterministic adapter and the same policy dispatcher.

## Required tests

- Typed and spoken versions of the same intent produce the same typed command.
- Unknown, malformed, or injected tool calls execute nothing.
- Multiple read functions correlate the correct responses by ID/name.
- Multiple mutation calls do not run concurrently or out of order.
- Repeated function IDs/idempotency keys do not duplicate resources.
- Patient agent cannot invoke clinician or billing tools.
- Stale/wrong patient context blocks all proposals and writes.
- A WebSocket reconnect restores only allowed relevant history, never authority.
- Muted chat does not accidentally play queued TTS audio.
- Missing backend/token/provider falls back to the deterministic typed demo.
- Typed fallback remains usable after a WebSocket failure without reconnecting first.
- Public-booking, patient-demo, and physician-demo sessions have distinct route/session/tool matrices; neither public nor patient-demo can be promoted or invoke physician tools.
- Replaying any one role's cookie/token against either other route family returns `401/403`.
- Direct token requests before voice-processing acknowledgment, after decline, or after revoke return `403`.
- No token, WebSocket, or audio capture starts before affirmative voice-processing consent; declining continues by typing.
- Revocation tears down the active microphone/WebSocket, drops queued media and unexecuted tool proposals, and late frames cannot mutate state.

## Official references

- [Deepgram Inject User](https://developers.deepgram.com/docs/voice-agent-inject-user-message)
- [Deepgram Voice Agent message flow](https://developers.deepgram.com/docs/voice-agent-message-flow)
- [Deepgram FunctionCallRequest](https://developers.deepgram.com/docs/voice-agent-function-call-request)
- [Deepgram FunctionCallResponse](https://developers.deepgram.com/docs/voice-agent-function-call-response)
- [Deepgram function-call context](https://developers.deepgram.com/docs/voice-agent-function-call-context)
- [Deepgram Browser Agent overview](https://developers.deepgram.com/docs/browser-agent-overview)
- [Medplum diagnostic orders](https://www.medplum.com/docs/labs-imaging)
- [Medplum Health Gorilla integration](https://www.medplum.com/docs/integration/health-gorilla)
- [Medplum referral management](https://www.medplum.com/docs/careplans/referrals)
- [Medplum DoseSpot integration](https://www.medplum.com/docs/integration/dosespot)
