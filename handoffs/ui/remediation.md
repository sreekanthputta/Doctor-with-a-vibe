---
id: UI-EVIDENCE-REMEDIATION
outcome: Physician cockpit proves the Ready workflow with allowlisted versioned evidence instead of resource-type labels.
owner: ui-remediation
state: review
dependencies:
  - main@8095d8979ce27e33ceee08717f3a1bba8bca5cff
owned_paths:
  - src/ui/**
  - handoffs/ui/remediation.md
forbidden_paths:
  - src/app/**
  - src/contracts/**
  - package.json
  - package-lock.json
acceptance:
  - each workflow resource row shows a fixed synthetic reference, business identifier, version, source timestamp, workflow role, and linkage summary
  - resolved missing-member Task history is explicit
  - eligibility Request to Response to Coverage linkage is explicit
  - sanitized application security evidence is separately labeled from FHIR Provenance and Medplum access audit
  - command palette is deferred so core evidence dominates
verification:
  - npm test -- src/ui
  - npm run typecheck
  - npm run lint
  - npm test
  - npm run build
  - npx playwright test
merge_gate:
  - all checks green
  - owned-path audit clean
---

## Files changed

- `src/ui/view-models.ts`
- `src/ui/fixtures/presentation.ts`
- `src/ui/components/EvidenceInspector.tsx`
- `src/ui/shells/physician-cockpit/PhysicianCockpitShell.tsx`
- `src/ui/__tests__/physician-cockpit-shell.test.tsx`
- `src/ui/ui.css`
- `handoffs/ui/remediation.md`

## RED evidence

Command:

```bash
npm test -- src/ui/__tests__/physician-cockpit-shell.test.tsx
```

Expected failing assertions: the command palette was still rendered; no accessible Medplum workflow evidence, resolved Task history, eligibility linkage, or separately labeled sanitized security-event regions existed.

Observed result: 4 intended assertion failures and 3 passes. Failures identified the existing command-palette dialog and the three absent evidence regions. The test runner itself was correctly configured after local `npm ci`.

## GREEN evidence

```text
npm test -- src/ui
9 files passed; 23 tests passed

npm run typecheck
passed

npm run lint
passed

npm test
35 files passed; 114 tests passed

npm run build
passed; Vite client and TypeScript server builds completed

npx playwright test
3 Chromium shell tests passed

git diff --check
passed
```

## Refactor performed

Extracted `EvidenceInspector` from the cockpit shell and introduced narrow presentation-only evidence types. Provider/FHIR payload types are not accepted by the UI model. Removed command-palette state, dialog, styles, and modifier-key handling; retained the existing J/K/E/Enter accessible workflow.

## Manual verification

Playwright loaded the production-built physician route in a distinct browser context and confirmed the source context remains visible. Component interaction tests confirmed keyboard navigation, explicit visit opening, exception display, loading/error/forbidden/empty isolation, and all evidence regions.

## Remaining risks

- Evidence is currently a deterministic fixed synthetic presentation fixture. Root composition must map only validated, allowlisted live evidence into this view model; it must never pass raw FHIR/provider payloads.
- Concrete visual palette remains intentionally unfrozen. No color values or visual snapshots were introduced.
- `UI.md` still describes a command palette as a future Cursor-inspired behavior. This lane could not modify documentation; root should record that it is deferred from the visible MVP.

## Requested contract change

None. Root may later promote the UI evidence projection into a runtime-validated shared contract if live server data supplies it; until then the fixture remains presentation-only.
