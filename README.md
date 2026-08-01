# VibeDoc

> One call. One ready visit. One physician exception inbox.

**VibeDoc — Powered by Medplum** is a FHIR-native operations layer for an independent adult primary-care microclinic. It completes routine administrative work under published practice rules, stores durable clinical/workflow state in Medplum, and routes uncertainty to an accountable human with source, owner, and deadline.

VibeDoc is the fictional virtual-first clinic and product brand, operated by one family physician without dedicated administrative staff. It is explicitly not a hospital; physical and specialty services remain with external human-operated partners.

Current status: architecture and hackathon scope approved; application scaffold not yet created.

## Hackathon proof

A fictional patient books an annual wellness visit through browser voice or text, supplies intake information, resolves one missing synthetic insurance member ID, receives a labeled eligibility response, and becomes Ready. The physician sees the visit in a Cursor-inspired cockpit with Medplum resources, timestamps, and provenance. A separate uncertain-identity replay stops safely and creates an owned exception without revealing PHI.

Medplum is the only required live dependency. Deepgram and Stedi sit behind typed adapters with deterministic fallbacks. Patient lookup and retrieval use exact, scoped Medplum queries. Moss is not used in the administrative MVP; it is reserved for a later, benchmark-gated index of public medication-label evidence—not patient records or safety decisions. Clinical chat, encounter transcription, referrals, orders, claims, PSTN, and SMS are roadmap.

## Documentation map

Normative precedence:

1. [`AGENTS.md`](./AGENTS.md) — safety, authorization, engineering rules, quality gates
2. [`HACKATHON.md`](./HACKATHON.md) — selected release, exact demo, acceptance criteria
3. [`CLINIC.md`](./CLINIC.md) — fictional adult primary-care microclinic, physician, services, exclusions, roadmap patient
4. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — canonical components, contracts, data ownership, state transitions
5. [`UI.md`](./UI.md) — patient and physician interaction contract
6. [`TRACING.md`](./TRACING.md) — compact function rows, real-time sanitized input/output, trace safety
7. [`DEEPGRAM.md`](./DEEPGRAM.md) — optional live voice/chat adapter and roadmap clinical tools
8. [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Railway-only runtime, variables, healthcheck, deployment gates
9. [`BUILD_PLAN.md`](./BUILD_PLAN.md) — dependency graph, parallel lanes, task board, integration cadence
10. [`DECISIONS.md`](./DECISIONS.md) — accepted architecture decisions and superseded alternatives
11. [`RESEARCH.md`](./RESEARCH.md) — non-normative evidence, vendor capabilities, alternatives, sources

If documents disagree, the earlier item in this list wins. Research describes possibilities; it does not expand the release.

## Delivery strategy

```text
fixture-first typed vertical slice
  -> live Medplum resource graph
  -> sanitized real-time function traces
  -> safety/race/reset tests
  -> optional Stedi test adapter
  -> optional Deepgram Voice Agent adapter
  -> one Railway service
  -> reviewer council
  -> freeze and rehearse
```

Railway is the sole deployment target. The hackathon runtime is one service that serves the React application, minimal secure gateway, `/health`, and role-bound trace stream; Medplum remains the only durable clinical/workflow store.

The multi-agent process follows ECC's strongest ideas: plan on disk, freeze contracts before parallel writers, give each lane exclusive file ownership, integrate every 60–90 minutes, use read-only fresh-context reviewers, and require evidence-based handoffs. It intentionally does not copy ECC's extensive agent catalog, hooks, or legacy Codex schema.

## Repository

[github.com/sreekanthputta/Doctor-with-a-vibe](https://github.com/sreekanthputta/Doctor-with-a-vibe)
