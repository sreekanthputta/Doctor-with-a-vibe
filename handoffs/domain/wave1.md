---
id: OP-101
outcome: Pure deterministic domain workflow for one request to one Ready visit and one fail-closed exception
owner: lane/domain
state: review
dependencies:
  - Gate 0A contracts and DEMO_V1
owned_paths:
  - src/domain/**
  - handoffs/domain/**
forbidden_paths:
  - package.json
  - package-lock.json
  - src/contracts/**
  - src/test/fixtures/**
  - src/fhir/**
  - src/ui/**
  - src/server/**
  - src/app/**
acceptance:
  - Closed administrative grammar rejects malformed/free-form input without scheduling or PHI authority
  - Tri-state demo identity derives identifiers server-side and models conditional-create convergence
  - Versioned policy allows only the frozen demo slots
  - Missing member ID keeps intake and eligibility incomplete and creates one required Task state
  - Coverage update, eligibility evidence, intake completion, and Task completion are ordered before Ready
  - One deterministic idempotent exception command accompanies every stop outcome
verification:
  - npm test -- src/domain
  - npm run typecheck
  - npm run lint
  - npm test
  - npm run build
merge_gate:
  - Green owned suite
  - Green repository regression suite
  - No changes outside owned paths
---

## Outcome

Implemented the Wave 1 network-free domain layer. The modules accept only root-frozen structured administrative intents, derive the synthetic identity rather than trusting a client identifier, fail closed on uncertain identity or non-administrative content, enforce the published slot policy, derive intake/readiness state, and sequence member-ID resolution before Ready.

No clinical triage, symptom classification, provider I/O, FHIR mutation, UI behavior, or credentials were introduced.

## Owned files changed

- `src/domain/administrative-grammar.ts`
- `src/domain/exception-policy.ts`
- `src/domain/identity-gate.ts`
- `src/domain/intake-completeness.ts`
- `src/domain/practice-policy.ts`
- `src/domain/readiness.ts`
- `src/domain/task-lifecycle.ts`
- `src/domain/workflow-reducer.ts`
- `src/domain/index.ts`
- eight corresponding files under `src/domain/__tests__/`
- `handoffs/domain/wave1.md`

## RED evidence

Command:

```bash
npm test -- src/domain
```

Intended assertion: the newly specified pure domain behavior must not exist before implementation.

Observed result: **8 failed suites**, each failing import resolution for its intentionally missing first-scaffold module (`administrative-grammar`, `identity-gate`, `practice-policy`, `workflow-reducer`, `readiness`, `exception-policy`, `task-lifecycle`, and `intake-completeness`). This was the permitted initial missing-module RED.

## GREEN evidence

```text
npm test -- src/domain  -> 8 files passed, 35 tests passed
npm run typecheck       -> passed
npm run lint            -> passed
npm test                -> 11 files passed, 47 tests passed
npm run build            -> passed
git diff --check         -> passed
```

## Refactor performed

- Centralized fixed safety copy and stable exception construction in `exception-policy.ts`.
- Centralized readiness derivation so the workflow reducer does not duplicate eligibility/open-Task rules.
- Kept identity normalization and the conditional-create conflict model separate from storage behavior.
- Added one barrel export without exposing provider, FHIR, server, or UI dependencies.

## Manual verification

Walked the reducer through the frozen Maria sequence in the unit suite:

```text
identity verified
  -> appointment booked
  -> intake missing member ID / requested Task / eligibility not-run
  -> member ID supplied
  -> Coverage updated
  -> linked eligibility evidence persisted
  -> intake completed
  -> original Task completed
  -> Ready
```

Also replayed a mixed clinical/administrative free-text stop and verified the exact fixed safety copy, stable exception idempotency key, stopped state, and refusal of a subsequent booking event.

## Remaining risks

- This lane models, but does not execute, conditional Patient creation, idempotent FHIR writes, linked eligibility persistence, or Task/Provenance commits; Lane B and root integration must prove those effects.
- The frozen root command union provides `create-identity-exception` but no generic `create-exception`. The domain therefore uses that existing command type for every stop while preserving the actual category in the payload. Root should consider a future contract rename only if it can be done before integration without destabilizing other lanes.
- The closed grammar deliberately does not parse raw natural language. Conversation adapters must emit the validated union; any raw/unmatched value fails closed.

## Requested contract change

Non-blocking: consider replacing or supplementing `create-identity-exception` with a category-neutral exception command name. No shared contract was changed by this lane.
