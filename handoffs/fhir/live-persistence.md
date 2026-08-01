# Medplum live persistence handoff

outcome: Full Medplum-backed ready-visit persistence port and adapter implemented
branch: `fix/medplum-live`
state: green

## Public API

`src/server/demo-persistence.ts` defines `DemoPersistence`:

- `start(identity)` validates the exact synthetic Maria identity, then persists and rereads the versioned `Patient`, booked `Appointment`, `Coverage`, in-progress `QuestionnaireResponse`, requested owned `Task`, `CommunicationRequest`, and delivered in-app `Communication`.
- `complete(memberId)` checks eligibility only after the member ID exists; updates `Coverage` and `QuestionnaireResponse` through `If-Match`; persists and rereads a linked `CoverageEligibilityRequest` and `CoverageEligibilityResponse`; transitions the same Task through `in-progress` to `completed` only after those writes succeed; then writes version-specific `Provenance` for each readiness mutation.
- `recordUncertainIdentity(correlationId)` persists one requested, human-owned, due exception Task with no Patient, candidate, focus, or PHI binding.
- `reset()` deletes only exact references recorded by this adapter instance, in reverse creation order, and verifies every deletion. Hosted Medplum reports deleted reads as `410 Gone`; this is accepted as verified absence.

Construct the adapter with `new MedplumDemoPersistence({ repository, deleteResource, runId, ... })` for dependency injection or `MedplumDemoPersistence.fromClient(client, { runId, ... })` for hosted Medplum. Root integration should inject this port; this lane intentionally does not edit `DemoWorkflowStore` or the server index.

Returned evidence contains only `resourceType`, exact `reference`, committed `version`, `sourceUpdatedAt`, and `workflowRole`. It contains no invented IDs and no Ready boolean; `phase` is derived only after all required persistence and lineage succeeds.

## TDD evidence

Initial RED:

```bash
npm test -- --run tests/integration/medplum-demo-persistence.test.ts
```

Result: intended missing-module failure for `src/adapters/medplum-demo-persistence.ts`.

Focused GREEN:

```bash
npm test -- --run tests/integration/medplum-demo-persistence.test.ts tests/live/medplum-full-graph.live.test.ts
```

Result: 5 mock integration tests passed; the opt-in live test skipped without credentials.

Hosted live GREEN (credentials supplied only through process environment; no values printed or persisted):

```bash
RUN_LIVE_MEDPLUM_TESTS=true npx vitest run tests/live/medplum-full-graph.live.test.ts --reporter=dot
```

Result: 1/1 passed. The test created isolated synthetic Organization/Practitioner/PractitionerRole/HealthcareService/Schedule/Slot support, wrote and reread the complete workflow graph, asserted committed versions and eligibility linkage, reset the workflow graph, and cleaned support resources in reverse order.

Provider conformance finding: a Medplum read after deletion returns `410 Gone` rather than an undefined resource. Reset now recognizes that response as verified deletion.

## Tests

- `tests/integration/medplum-demo-persistence.test.ts`
  - dependency-ordered create and reread
  - exact allowlisted evidence
  - linked eligibility and Task ordering
  - eligibility persistence failure leaves Task requested
  - one unbound uncertain-identity Task
  - reverse exact-reference reset and absence verification
- `tests/live/medplum-full-graph.live.test.ts`
  - opt-in hosted full-graph create/reread/update/link/version/reset conformance

## Remaining risks

- The root server has not yet injected the port, so visible routes still use the in-memory demo store until integration.
- A failure after some versioned writes but before the final Provenance set requires explicit reconciliation rather than blind mutation retry. The adapter throws and never returns `ready`; root should surface this as a blocked/reconciling state.
- `Patient` conditional create may reuse a pre-existing exact synthetic Maria. Reset correctly does not delete a Patient this adapter instance did not create.
