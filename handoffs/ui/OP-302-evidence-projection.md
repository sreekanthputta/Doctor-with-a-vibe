---
id: OP-302-evidence-projection
outcome: Physician evidence can render exact persistence references, versions, and timestamps with independent conversation and Medplum persistence labels.
owner: lane-c-ui
state: review
dependencies: [DemoWorkflowSnapshot.resourceEvidence]
owned_paths: [src/ui/**, handoffs/ui/**]
forbidden_paths: [src/app/**, src/server/**, src/contracts/**, src/styles/**, package.json, package-lock.json]
acceptance:
  - persistence evidence values are preserved verbatim
  - missing business identifiers are omitted rather than invented
  - deterministic conversation and Medplum persistence modes have separate labels
  - resolved Task and eligibility cards use exact evidence references when available
verification:
  - npm test -- src/ui
  - npx tsc -p tsconfig.app.json --noEmit --pretty false
  - npx eslint src/ui
merge_gate:
  - root integrates the projection in src/app/App.tsx
---

Outcome:
Added a UI-only persistence-evidence projection and source-mode display. The mapper mirrors the server evidence shape structurally without importing server types.

Owned files changed:
- `src/ui/mappers/evidence-presentation.ts`
- `src/ui/components/EvidenceInspector.tsx`
- `src/ui/view-models.ts`
- `src/ui/__tests__/evidence-presentation.test.tsx`
- `handoffs/ui/OP-302-evidence-projection.md`

RED command:
`npm test -- src/ui/__tests__/evidence-presentation.test.tsx`

Expected failing assertion:
The new persistence evidence mapper/source-mode support did not exist.

Observed RED result:
Vitest failed to resolve `../mappers/evidence-presentation`; 1 failed suite, 0 tests collected. This was the permitted initial module-scaffold RED.

GREEN commands and results:
- `npm test -- src/ui`: 10 files passed, 27 tests passed.
- `npx tsc -p tsconfig.app.json --noEmit --pretty false`: exit 0.
- `npx eslint src/ui`: exit 0.
- `git diff --check`: exit 0.

Repository-wide typecheck note:
`npm run typecheck` was attempted but a concurrent, out-of-lane edit failed in `src/adapters/medplum-demo-persistence.ts:185` because `patient` was used before declaration. The UI application TypeScript project itself passes.

Refactor performed:
Centralized workflow-role presentation and source labels. Exact authoritative values are copied without parsing or synthesizing IDs. Missing business identifiers are not rendered.

Manual verification:
Component tests render a live-looking `CoverageEligibilityResponse` reference/version/timestamp, the two independent source rows, and exact Task/eligibility linkage references.

Root App integration:
1. Import `projectPersistedWorkflowEvidence` from `../ui/mappers/evidence-presentation`.
2. When composing a physician visit, call it with `evidence: snapshot.resourceEvidence`, `conversation: 'deterministic-typed'`, `persistence: snapshot.providerMode === 'live' ? 'medplum-live' : 'medplum-fixture'`, `workflowStatus: snapshot.visit.status`, and `taskOwnerDisplay: 'Dr. Maya Chen'`.
3. Spread the returned projection after the presentation fixture/base visit so `evidenceResources`, `resolvedTaskHistory`, `eligibilityLinkage`, and `sourceModes` replace all static evidence fields.
4. Do not derive or inject a business identifier unless the server adds the exact persisted value to its evidence contract.
5. The legacy `sourceLabel` remains temporarily required for compatibility, but `EvidenceInspector` prefers `sourceModes` when provided.

Remaining risks:
- The server evidence shape currently lacks business identifiers, Task status/owner, and explicit request-to-response references. The UI derives only display linkage from the frozen Ready state and workflow roles; authoritative readiness remains server/domain-owned.
- Unknown workflow roles receive a neutral evidence presentation. The exact server role label is still displayed verbatim.

Requested contract change:
None required for this integration. A future server evidence contract may include exact business identifiers and typed relationship references.
