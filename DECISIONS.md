# VibeDoc Architecture Decisions

> Normative priority: records accepted decisions; `AGENTS.md` and `HACKATHON.md` still govern.

## D-001 — Narrow hackathon wedge

Status: accepted
Decision: demonstrate one administrative annual-wellness request becoming one Ready visit. The full automated micropractice is the product roadmap, not the judged demo.

## D-002 — Medplum-live, fixture-first

Status: accepted
Decision: Medplum is the only required live dependency. Every other provider implements the same typed interface as a deterministic fixture/fallback.

## D-003 — Deepgram live plus independent typed fallback

Status: accepted
Decision: live voice and live typed agent chat may share one role-specific Deepgram Voice Agent session using audio or `InjectUserMessage`. When Deepgram is unavailable, typed input bypasses it through `ScriptedConversationAdapter` and emits the same validated `AdministrativeIntent`.

Supersedes: the claim that all typed chat must use the live Deepgram WebSocket.

## D-004 — Deepgram proposes; VibeDoc authorizes

Status: accepted
Decision: Deepgram provides speech, Think/LLM output, and function proposals. Its output, IDs, `client_side` flag, and history do not confer authority. VibeDoc owns identity, role/tool allowlists, policy, state transitions, confirmation, idempotency, and mutations.

## D-005 — Ready means no required open exception

Status: accepted
Decision: the patient initially omits a synthetic insurance member ID required by the physician-authored demo policy. The workflow creates one idempotent Task, collects the ID, updates `Coverage`, records eligibility evidence, completes that same Task, and only then displays Ready. The separate uncertain-identity replay supplies the open exception shown in the cockpit.

Supersedes: using a missing medication list as an administrative exception and calling the visit Ready while its Task is open.

## D-006 — Eligibility projection

Status: accepted
Decision: `Coverage` represents the policy. The normalized eligibility transaction is stored as `CoverageEligibilityRequest` and `CoverageEligibilityResponse`, tagged/labeled as fixture or live and linked to the provider transaction/source identifier. Missing fields remain explicit. Stedi remains authoritative for its external response.

## D-007 — Separate actor trust domains

Status: accepted
Decision: public/patient and physician experiences use separate routes, sessions, prompts, audit identities, and tool allowlists. A public session cannot be promoted to clinician context.

## D-008 — Synthetic demo access

Status: accepted
Decision: username-only input is a fictional persona selector labeled Synthetic Demo Access. It is not authentication and never exposes real or arbitrary user-entered patient data. Production requires verified-channel passwordless authentication or stronger controls.

## D-009 — ECC adaptation

Status: accepted
Decision: reuse ECC's thin vertical slice, dependency lanes, explicit ownership, on-disk plan, single integrator, read-only reviewers, green handoffs, and verification. Do not install/copy ECC wholesale, use its legacy Codex schema, or create agent/control-plane sprawl.

Reference inspected: `affaan-m/ECC@e4e4163101f162881e628f300a9ca4e6a940bcea`.

## D-010 — Clinical actions are staged roadmap

Status: accepted
Decision: future orders, referrals, prescriptions, notes, and claims follow Ask → inspect → edit/review → sign → transmit → acknowledge → track. Creating a FHIR resource is not external delivery, and conversational assent is not a clinical signature.

## D-011 — No Moss in the administrative MVP; conditional medication-evidence roadmap

Status: accepted
Decision: use exact, authorization-scoped Medplum queries for all patient and workflow retrieval. Moss may later be benchmarked as an index of public, versioned medication-label passages only. It never stores patient facts, performs safety checks, or replaces RxNorm normalization, validated interaction/rules data, authoritative-source revalidation, or clinician judgment.

## D-012 — Platform, microclinic, specialty, and persona

Status: accepted
Decision: VibeDoc is both the visible product and fictional virtual-first adult primary-care microclinic brand, always endorsed as `Powered by Medplum`; Dr. Maya Chen is its fictional family physician; Maria Lopez is the single synthetic patient. The product is not a hospital. The hackathon shows Maria's administrative annual-wellness readiness flow; her cardiometabolic/medication scenario is governed roadmap only.

## D-013 — Railway is the sole deployment target

Status: accepted
Decision: deploy one long-running Railway service containing the React SPA, minimal Node gateway, `/health`, and role-bound sanitized trace stream. Use Railway's injected `PORT` and service variables. Do not add a second host, database, volume, worker, or deployment path without a demonstrated blocker; Medplum remains durable state.

## D-014 — Function execution is visible through sanitized live traces

Status: accepted
Decision: compact function rows appear beneath the initiating assistant message and update in place from queued/running through terminal state. Clicking reveals only tool- and role-specific allowlisted input/output projections. Traces are explanatory UI state, not workflow authority, Provenance, access audit, or chain-of-thought, and never contain secrets, hidden prompts, raw provider payloads, or unrestricted FHIR resources.

## D-015 — Palette awaits visual-direction approval

Status: accepted
Decision: preserve the patient/physician information architecture and interaction hierarchy, but do not implement the earlier ivory/sage/teal palette. Generate and compare explicit visual directions under `design/variants/`; freeze global color tokens only after user approval or an instructed blend.

## D-016 — Four page shells, contextual detail

Status: accepted
Decision: the MVP has four page shells: `/` public access with embedded front-desk conversation, `/demo` neutral Synthetic Demo Access, `/patient/*` patient workspace, and `/physician/*` physician cockpit. Intake, appointment, coverage, exception, trace, FHIR resource, and Provenance detail remain nested panels, drawers, or client routes inside the owning shell. Trust-domain transitions always issue a new server-bound session.

## D-017 — Test-first implementation

Status: accepted
Decision: every behavioral task follows recorded RED → GREEN → REFACTOR. Tests are written before implementation; writers may not weaken tests to pass. Vitest covers unit/contract/component behavior and Playwright covers the critical browser path. Live-provider checks are optional and environment-gated; fixture tests always run.

## D-018 — Three non-overlapping writer lanes

Status: accepted
Decision: after integrator Gate 0 freezes contracts, scripts, fixtures, route shells, and ownership, run at most three concurrent writers: domain/workflow, FHIR/data, and UI. Writers own disjoint source and test paths. The root integrator alone owns dependencies, lockfiles, contracts, app/server composition, cross-lane tests, Railway configuration, commits, and merges.

## D-019 — Voice revocation is enforced by VibeDoc

Status: accepted
Decision: voice consent creates an application capability distinct from the role session. Revocation immediately invalidates that capability, closes the known provider/media session, denies new provider-token issuance, and rejects late or replayed tool events while typed administrative access continues. An already issued Deepgram token is allowed to expire under its provider TTL; VibeDoc does not claim provider-side instant revocation without live conformance evidence, and no provider token carries PHI or durable mutation authority.

## D-020 — Accepted hackathon risk for completion-provider exception durability

Status: accepted MEDIUM risk for the synthetic hackathon release only
Decision: if the record provider fails during the valid member-ID completion step, VibeDoc keeps the authoritative visit in Needs attention, leaves the original required Task open, returns `503`, and exposes one owned, human-acknowledgeable provider-failure exception in the running process. That secondary exception and its acknowledgment are not durable when the same record provider is unavailable, so a restart may lose them; the persisted missing-member Task still blocks Ready and preserves the operational need. Production must add a durable recovery marker or out-of-band exception store before handling real patients. This risk does not permit a false Ready state or a claim that the exception was persisted.
