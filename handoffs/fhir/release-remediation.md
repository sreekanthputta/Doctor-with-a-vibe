# FHIR release remediation

```yaml
id: OP-202-release-remediation
outcome: Medplum persistence fails closed on ambiguous identity and derives Ready from reread linked evidence
owner: fhir-lane
state: review
dependencies: [OP-202]
owned_paths:
  - src/fhir/**
  - src/adapters/medplum-demo-persistence.ts
  - tests/integration/medplum-demo-persistence.test.ts
  - handoffs/fhir/**
acceptance:
  - dynamic four-hour exception deadline
  - unique exact Patient binding after conditional create
  - Coverage committed before eligibility invocation
  - partial completion resumes idempotently
  - malformed reread eligibility cannot produce Ready
  - uncertain Task acceptance is version-aware and idempotent
verification:
  - npm test -- tests/integration/medplum-demo-persistence.test.ts
  - npm run typecheck
merge_gate:
  - owned suite green
  - no out-of-lane files staged
```

## TDD evidence

RED: `npm test -- tests/integration/medplum-demo-persistence.test.ts` produced six intended assertion failures: historical due end, ambiguous Patient accepted, eligibility called before Coverage update, retry version conflict, malformed eligibility projected Ready, and missing acknowledgment method.

GREEN: the same command passes 11/11 tests. `npm run typecheck` passes.

Lane merge gate: `npm test -- src/fhir tests/integration/medplum-demo-persistence.test.ts tests/integration/medplum-repository.test.ts` passes 57/57 tests across 13 files; `npm run lint` passes.

## Implementation

- Deadlines are derived from the injected clock plus the frozen four-hour policy.
- Conditional Patient create is followed by an exact identifier search, uniqueness check, returned-reference match, and frozen demographic validation before any Appointment is written.
- Coverage and completed intake are committed/reread before eligibility is called.
- Identifier-backed create reconciliation and in-memory version advancement make partial completion resumable without duplicate eligibility resources.
- Linked eligibility request/response, source, coverage reference, outcome, and completed Task are reread before Ready.
- Uncertain identity acknowledgment rereads the Task, applies the existing human-only version-aware transition, rereads evidence, and returns accepted idempotently.

## Remaining risks

- Hosted `$book` slot-race behavior remains outside this adapter; it currently persists a booked Appointment through the repository and validates returned Slot references.
- Restart recovery before `start()` reconstructs the run is not implemented; resumability here covers repeated calls within the running persistence instance and identifier-backed create reconciliation.
- Post-commit Provenance remains intentionally non-atomic under the frozen `post-commit-versioned` mode.
