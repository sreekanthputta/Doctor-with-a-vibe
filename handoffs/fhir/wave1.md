---
id: OP-201
outcome: Pure FHIR R4 builders, fixture repository boundaries, and safe synthetic seed/reset planning for the one-request-to-ready-visit graph
owner: lane/fhir
state: review
dependencies:
  - Gate 0A contracts and DEMO_V1
owned_paths:
  - src/fhir/**
  - src/demo/seed/**
  - handoffs/fhir/**
forbidden_paths:
  - package.json
  - package-lock.json
  - src/contracts/**
  - src/test/fixtures/**
  - src/domain/**
  - src/ui/**
  - src/app/**
  - src/server/**
  - src/styles/**
acceptance:
  - Conditional synthetic Patient identity create derives its identifier server-side.
  - Coverage and QuestionnaireResponse updates require current versions.
  - Questionnaire canonical, version, linkIds, source, author, completion, and value types are enforced.
  - Missing-member and uncertain-identity Tasks are owned, due, requested, and semantically valid FHIR R4; uncertain identity contains no candidate or Patient PHI.
  - Eligibility cannot be built before member ID and absent benefits are omitted from FHIR while projections label them not-returned.
  - Scheduling captures returned Appointment/Slot references, prevents fixture double-booking, and supports idempotent retry.
  - Post-commit Provenance targets exact history versions and missing lineage never retries a committed mutation.
  - The deeply frozen baseline seed excludes Maria and workflow resources; reset uses only explicit namespaced references.
verification:
  - npm test
  - npm run typecheck
  - npm run lint -- --quiet
  - npm run build
merge_gate:
  - All repository tests and required static/build checks green.
  - Only lane-owned paths changed.
implementation_commit: 8ed2f3147a3faafaaa7e72aed53ddc591c4ade9f
---

## Outcome

Implemented a network-free, strict-TypeScript FHIR/data layer for the deterministic demo. It includes typed Patient, Coverage, Questionnaire/QuestionnaireResponse, Task, eligibility, scheduling, communication, and Provenance builders; centralized mutation allowlisting and repository ports; response-loss and lineage reconciliation plans; a conflict-safe in-memory scheduling fixture; and a namespaced seed/reset manifest.

## Owned files changed

- `src/fhir/**`: 11 implementation modules and 11 test files.
- `src/demo/seed/manifest.ts`: deeply frozen baseline resources and explicit reset plan.
- `handoffs/fhir/wave1.md`: this evidence record.

No shared contract, fixture, package, lock, configuration, UI, domain, app, server, or style file was changed.

## RED evidence

### Initial scaffold RED

Command:

```bash
npm test -- src/fhir
```

Expected: the newly written FHIR suites fail before lane modules exist.

Observed: 10 suites failed to resolve the new mapper/repository modules; 0 tests executed. This is the one permitted missing-module scaffold RED.

### Behavioral semantics RED

Command:

```bash
npm test -- src/fhir
```

Expected assertions: wrong questionnaire answer type is rejected; a non-booked response cannot be captured; stale expected versions are rejected; seed resources are deeply frozen.

Observed: 4 assertion failures, each reporting that the function did not throw or that nested seed state was not frozen. There were no syntax/configuration/import failures.

### Booking race RED

Command:

```bash
npm test -- src/fhir/__tests__/scheduling-repository.contract.test.ts
```

Expected assertion: exactly one competing request wins a free Slot.

Observed: the assertion expected 1 fulfilled request but received 2. The fixture repository was then changed to claim the slot synchronously and recognize idempotent business-identifier retries.

## GREEN evidence

Final commands and results:

```text
npm test
14 test files passed; 45 tests passed

npm run typecheck
exit 0

npm run lint -- --quiet
exit 0

npm run build
exit 0; TypeScript and Vite production build completed

git diff --check
exit 0
```

Owned FHIR suite result: 11 files, 33 tests passed.

## Refactor performed

- Centralized demo identifiers and version-reference checks.
- Replaced a non-R4 `Task.supportingInfo` concept with typed `Task.input.valueReference` entries for Appointment and Coverage.
- Represented the Provenance idempotency identifier as a namespaced extension because FHIR R4 `Provenance` has no native `identifier` element.
- Separated source FHIR omission semantics from presentation-only `not-returned` states.
- Deep-froze nested seed state to prevent cross-test mutation.

## Manual verification

- Inspected the baseline resource-type set and confirmed Maria, member ID, and workflow-created types are absent.
- Inspected the uncertain-identity Task serialization and confirmed it has no `for`, `focus`, Patient reference, candidate demographic, or raw correlation identifier.
- Exercised two same-tick booking calls: one booked result, one conflict; repeated the winning business identifier and received the existing booking.
- No network, live provider, or credential was used.

## Remaining risks

- Hosted Medplum conformance remains OP-202: conditional create behavior, scheduling `$book`, returned identifiers/references, cleanup, optimistic version transport, and version-specific Provenance must be observed against the hackathon project.
- The `urn:vibedoc:provenance-business-identifier` extension is an app-owned demo convention and should be formalized as a StructureDefinition before production.
- Fixture-generated resource IDs exist only for deterministic tests; live code must never assume those IDs.
- Administrative follow-up payload text is fixed and privacy-minimal, but production communication policy and delivery evidence need privacy/counsel review.

## Requested contract change

None.
