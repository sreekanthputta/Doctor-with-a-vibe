# FHIR safety remediation handoff

outcome: Reviewer findings remediated in the FHIR/data lane
branch: `fix/fhir-safety`
state: green

## Scope

- Patient conditional-create identity now uses `DEMO_V1.patientBusinessId` exactly and is cross-tested against `decideDemoIdentity`.
- Appointment construction and the baseline Schedule use `DEMO_V1.practitionerRoleReference`.
- Scheduling reservations derive the Slot from the Appointment and require exactly one valid `Slot/{id}` reference; booked response capture enforces the same invariant.
- Eligibility responses accept no caller-supplied linkage context. Patient, coverage, insurer, provider/requestor, status, and purpose are validated and derived from the persisted request. Returned copay is represented as a valid R4 benefit with USD Money and round-trips through the projection.
- Questionnaire completion requires the frozen canonical/version, `in-progress` status, one occurrence of every allowed linkId and no unknown linkIds, correctly typed nonblank trimmed answers, and identical Patient subject/source/author binding.
- Task dates require valid timezone-bearing ISO datetimes in increasing order. Human ownership derives from the frozen PractitionerRole. The generic exception builder preserves its category while leaving patient/focus/input unbound.
- Reset planning consumes a server-created opaque run manifest backed by an internal exact-reference registry. Arbitrary resources, forged manifest objects, baseline resources, disallowed types, and non-namespaced resources are rejected.

## TDD evidence

Initial dependency bootstrap was required because the isolated worktree had no `node_modules`; `npm ci` completed from the committed lockfile without changing it.

RED command:

```bash
npm test -- --run src/fhir/__tests__/patient-coverage-mapper.test.ts src/fhir/__tests__/scheduling-repository.contract.test.ts src/fhir/__tests__/scheduling-mapper.test.ts src/fhir/__tests__/eligibility-mapper.test.ts src/fhir/__tests__/questionnaire-response-mapper.test.ts src/fhir/__tests__/task-mapper.test.ts src/fhir/__tests__/seed-reset.test.ts
```

RED result: 19 intended failures across identity alignment, scheduling Slot derivation, persisted-request eligibility linkage, questionnaire validation, Task profiles, and server-owned reset behavior.

A second focused RED proved the frozen PractitionerRole mapping:

```bash
npm test -- --run src/fhir/__tests__/scheduling-mapper.test.ts src/fhir/__tests__/scheduling-repository.contract.test.ts src/fhir/__tests__/seed-reset.test.ts
```

RED result: 2 intended assertions failed because Appointment and Schedule still referenced `Practitioner/maya`.

GREEN merge gate:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

GREEN result: strict typecheck passed; lint passed; 35 files and 121 tests passed; production Vite and server TypeScript builds passed; diff check passed.

## Files changed

- `src/fhir/patient.ts`
- `src/fhir/scheduling.ts`
- `src/fhir/eligibility.ts`
- `src/fhir/questionnaire.ts`
- `src/fhir/tasks.ts`
- `src/demo/seed/manifest.ts`
- owned regression tests under `src/fhir/__tests__/`
- this handoff

## Integration notes

- `SchedulingRepository.book` now receives only an `Appointment`; callers must not pass a separate Slot reference.
- `buildAppointmentDraft` no longer accepts a practitioner argument because the visible demo is fixed to `DEMO_V1.practitionerRoleReference`.
- `buildEligibilityResponse` now accepts only `responseBusinessId`, `createdAt`, the persisted request, and adapter result.
- `planNamespacedReset` now requires a manifest returned by `createServerOwnedRunManifest`; workflow commits must be registered through `recordCreatedRunResource` using the exact persisted returned resource.
- No network calls, credentials, clinical mutations, or non-owned paths were introduced.

## Remaining risk

- The server integration must call `recordCreatedRunResource` only after an exact successful create response; the in-memory manifest intentionally does not survive process restart.
- Hosted Medplum conformance must still verify response shapes and post-commit Provenance behavior before the live provider path is enabled.
