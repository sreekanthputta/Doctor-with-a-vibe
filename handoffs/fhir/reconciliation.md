---
id: OP-202-reconciliation
outcome: Restart and response-loss reconciliation reuse one stable Medplum workflow graph and repair exact version lineage.
owner: medplum-reconciliation
state: complete
dependencies:
  - OP-202
owned_paths:
  - src/adapters/medplum-demo-persistence.ts
  - tests/integration/medplum-demo-persistence.test.ts
  - handoffs/fhir/reconciliation.md
forbidden_paths:
  - src/server/index.ts
  - package.json
  - package-lock.json
acceptance:
  - Stable workflow identifiers prevent a restarted process from booking a second Appointment.
  - Singleton and array FHIR identifiers both participate in idempotent reuse.
  - A persisted needs-attention graph can resume to Ready after restart.
  - A persisted Ready graph can be restored without duplicate workflow resources.
  - Commit-then-lost-response for Provenance repairs lineage without retrying the target mutation.
  - Every restored Provenance targets the exact current committed resource version.
  - Restart hydration rebuilds the exact workflow cleanup manifest so reset removes the synthetic graph.
verification:
  - npm test -- tests/integration/medplum-demo-persistence.test.ts
  - npm run typecheck
  - npm run lint
  - npm test
  - npm run build
merge_gate:
  - Full repository gate green.
---

## Outcome

`MedplumDemoPersistence` now exposes `restore(): Promise<DemoPersistenceSnapshot | undefined>`. It reconstructs a run from stable FHIR business identifiers, validates patient and eligibility links, returns `needs-attention` or `ready`, and hydrates the adapter so `complete()` can safely continue.

`start()` invokes restoration before creating anything and queries the stable Appointment identifier before `$book`. The generic reuse path recognizes both FHIR `Identifier[]` and singleton `Identifier` fields, including `QuestionnaireResponse.identifier`.

Post-commit Provenance uses a stable namespaced `meta.tag` and conditional create. A lost conditional-create response is reconciled by the tag; the recovered Provenance must target the exact `ResourceType/id/_history/version` or restoration fails closed.

## Files changed

- `src/adapters/medplum-demo-persistence.ts`
- `tests/integration/medplum-demo-persistence.test.ts`
- `handoffs/fhir/reconciliation.md`

## RED evidence

Command:

```bash
npm test -- tests/integration/medplum-demo-persistence.test.ts
```

Expected failing assertions:

- restart calls atomic booking only once;
- a new adapter instance exposes `restore()` and reconstructs Ready;
- a committed Provenance whose response is lost is recovered without duplicate lineage.

Observed RED:

- booking call count was `2`, expected `1`;
- `restore is not a function`;
- the old non-conditional Provenance path did not surface/reconcile the simulated lost response.

A second focused RED added restart-safe reset. After hydration, `reset()` reported success but left eight previously committed workflow resources. Restoration now rebuilds the exact cleanup manifest from the stable Appointment graph and, only when atomic scheduling is configured, its exact returned Slot references.

## GREEN evidence

Focused suite:

```text
tests/integration/medplum-demo-persistence.test.ts: 16 passed
```

Full merge gate:

```text
npm run typecheck: passed
npm run lint: passed
npm test: 41 files passed, 2 skipped; 184 tests passed, 3 skipped
npm run build: passed (client and SSR server bundles)
```

## Refactor performed

- Centralized array/singleton FHIR identifier extraction.
- Centralized exact-one identifier lookup and ambiguity rejection.
- Centralized conditional, version-target-validated Provenance reconciliation.

## Integration API

Use a stable deployment-independent run ID, then hydrate before exposing workflow state:

```ts
const persistence = MedplumDemoPersistence.fromClient(client, {
  runId: 'demo-v1-main',
  seedReferences,
});
const restored = await persistence.restore();
```

`undefined` means no Appointment exists for that run. A returned snapshot also initializes the adapter for a later `complete(memberId)` call. A partial pre-Ready graph returns `undefined` from `restore()` so `start(exactIdentity)` can idempotently fill its missing resources. A completed Task with missing/malformed eligibility evidence throws and must surface as reconciliation/provider failure rather than Ready.

## Manual verification

The in-memory repository test creates a graph, constructs a fresh adapter instance over the same durable resources, resumes Needs attention to Ready, then constructs another instance and restores Ready. It asserts one Appointment, one workflow resource of each type, five Provenance resources, and exact target version matches.
It also resets through the restarted instance and verifies that no synthetic workflow resource remains.

## Remaining risk

The existing hosted live suite has no dedicated restart/Provenance-response-loss case. `_tag` conditional-create behavior is standard FHIR token-search behavior and matches the repository transaction boundary, but should be exercised once against the namespaced synthetic hosted project before demo freeze. Do not destructively clean resources outside the recorded synthetic manifest.
