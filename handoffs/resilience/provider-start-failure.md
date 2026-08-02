---
id: OP-007-provider-start-resilience
outcome: A verified live workflow stops safely with one owned provider-failure exception when persistence start fails, and expired owner sessions can be detected for lease release.
owner: workflow-resilience
state: complete
dependencies: []
owned_paths:
  - src/server/demo-workflow-store.ts
  - src/server/session-store.ts
  - tests/integration/demo-workflow-store.test.ts
  - tests/integration/session-store.test.ts
  - handoffs/resilience/provider-start-failure.md
forbidden_paths:
  - src/server/index.ts
  - package.json
  - package-lock.json
acceptance:
  - Persistence start failure returns stopped instead of throwing.
  - The single exception is requested, owned by Dr. Chen's configured PractitionerRole, and categorized provider-failure.
  - Verified identity remains verified and provider mode remains live.
  - No Appointment evidence or identity-failure copy is fabricated.
  - A repeated request does not retry or duplicate the exception.
  - Session expiry can be checked without exposing session contents.
verification:
  - npm test -- tests/integration/demo-workflow-store.test.ts tests/integration/session-store.test.ts
  - npx eslint src/server/demo-workflow-store.ts src/server/session-store.ts tests/integration/demo-workflow-store.test.ts tests/integration/session-store.test.ts
merge_gate:
  - Root integrates SessionStore.isActive into workflow-owner lease release.
  - Root runs the combined typecheck/lint/test/build gate after concurrent Medplum reconciliation work is green.
---

## Files changed

- `src/server/demo-workflow-store.ts`
- `src/server/session-store.ts`
- `tests/integration/demo-workflow-store.test.ts`
- `tests/integration/session-store.test.ts`
- `handoffs/resilience/provider-start-failure.md`

## RED evidence

Command:

```bash
npm test -- tests/integration/demo-workflow-store.test.ts
```

Intended assertion: a rejected live persistence `start` call becomes one safe, owned `provider-failure` stop rather than escaping as an exception.

Observed: one intended failure, `Error: provider unavailable`, originating from `DemoWorkflowStore.submitRequest`; 8 existing tests passed.

Command:

```bash
npm test -- tests/integration/session-store.test.ts
```

Intended assertion: callers can detect when a workflow-owner session lease expires.

Observed: one intended failure, `TypeError: store.isActive is not a function`; 4 existing tests passed.

## GREEN evidence

```bash
npm test -- tests/integration/demo-workflow-store.test.ts tests/integration/session-store.test.ts
```

Result: 2 files passed, 14 tests passed.

```bash
npx eslint src/server/demo-workflow-store.ts src/server/session-store.ts tests/integration/demo-workflow-store.test.ts tests/integration/session-store.test.ts
```

Result: exit 0, no findings.

Full repository `npm run typecheck` and `npm run lint` were attempted but were temporarily blocked by concurrent, out-of-lane edits in `tests/integration/medplum-demo-persistence.test.ts` that referenced a not-yet-present `restore` method and had related lint errors. No out-of-lane file was changed.

After root integration, the full repository gate passed: typecheck, lint, 184 unit/integration tests with 3 intentional skips, production build, and 8 Chromium E2E tests.

## Refactor performed

The provider failure uses the existing domain `createStopOutcome` to retain the stable exception command/idempotency identifier. Provider errors are never surfaced in copy or evidence. A small private helper centralizes the terminal snapshot and best-effort exception persistence. Snapshot typing was simplified to the existing `DemoPersistenceSnapshot` contract.

## Manual verification

The integration test verifies a configured live persistence, verified Maria identity, rejected `start`, stable terminal retry behavior, provider-specific copy, absence of Appointment evidence, and one provider-failure persistence attempt.

## Remaining risks

- If the live record provider cannot accept either the workflow mutation or the exception Task, the stop remains safely visible in process memory but cannot be claimed as durable Medplum state. The UI must not claim a persisted Task without evidence.
- Provider failure exceptions remain in process memory when the same unavailable provider cannot persist the Task; the UI does not claim durable evidence in that state.

## Requested contract change

None.
