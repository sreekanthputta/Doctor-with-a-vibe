# Hosted baseline and atomic booking

```yaml
id: OP-202-live-baseline-booking
outcome: Hosted Medplum baseline resolves actual references and $book admits exactly one concurrent winner
owner: fhir-lane
state: review
dependencies: [OP-202-release-remediation]
owned_paths:
  - src/fhir/**
  - src/adapters/medplum-demo-persistence.ts
  - src/server/live-medplum-baseline.ts
  - tests/integration/live-medplum-baseline.test.ts
  - tests/integration/medplum-demo-persistence.test.ts
  - tests/live/medplum-full-graph.live.test.ts
acceptance:
  - conditional idempotent baseline with actual hosted references
  - one actor, timezone, service reference, and SchedulingParameters
  - Appointment/$book used for live persistence
  - booked Appointment and busy Slots validated and cleanup-recorded
  - exactly one winner for concurrent hosted booking
verification:
  - npm test -- src/fhir tests/integration/medplum-demo-persistence.test.ts tests/integration/medplum-repository.test.ts tests/integration/live-medplum-baseline.test.ts
  - npm run test:live:medplum
  - npm run typecheck
  - npm run lint
```

## TDD evidence

RED: targeted scheduling/baseline tests failed because the hosted `$book` repository and live baseline module did not exist. The persistence integration assertion then failed because the adapter still directly created a booked Appointment.

GREEN:

- 62/62 lane tests pass across 14 files.
- Typecheck and lint pass.
- Hosted Medplum conformance passes 3/3: repository CRUD, full ready-visit graph through `$book`, and an actual concurrent race with one fulfilled booking and one typed `SlotConflict`.

## Integration requirement

The root server must call `ensureLiveMedplumBaseline(new MedplumFhirRepository(client))` after login and pass the returned `seedReferences` to each `MedplumDemoPersistence.fromClient`. The helper owns no server startup behavior and was intentionally not wired in `src/server/index.ts` by this lane.

## Remaining risks

- Medplum scheduling is beta; the deterministic direct-create fixture path remains the outage fallback and is explicitly distinct from live `$book`.
- Baseline resources are durable shared synthetic configuration and are intentionally not deleted by per-run reset. Run-created Appointment/busy Slots are cleanup-recorded.
- `$book` response-loss reconciliation by Appointment workflow identifier is not yet implemented inside the scheduling repository; the hosted transaction is atomic, but a transport loss after commit requires the outer mutation reconciliation path before retry.
