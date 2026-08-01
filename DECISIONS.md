# OnePractice Architecture Decisions

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

## D-004 — Deepgram proposes; OnePractice authorizes

Status: accepted
Decision: Deepgram provides speech, Think/LLM output, and function proposals. Its output, IDs, `client_side` flag, and history do not confer authority. OnePractice owns identity, role/tool allowlists, policy, state transitions, confirmation, idempotency, and mutations.

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
Decision: OnePractice is the platform; OneCare Clinic is the fictional virtual-first adult primary-care microclinic; Dr. Maya Chen is its fictional family physician; Maria Lopez is the single synthetic patient. The product is not a hospital. The hackathon shows Maria's administrative annual-wellness readiness flow; her cardiometabolic/medication scenario is governed roadmap only.
