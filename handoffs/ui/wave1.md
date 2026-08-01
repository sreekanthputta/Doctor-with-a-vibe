---
id: OP-301
outcome: Accessible modular UI shells and evidence components for the deterministic Ready-visit proof
owner: lane/ui
state: review
dependencies:
  - OP-002
owned_paths:
  - src/ui/**
  - handoffs/ui/**
forbidden_paths:
  - package.json
  - package-lock.json
  - src/contracts/**
  - src/test/**
  - src/domain/**
  - src/fhir/**
  - src/server/**
  - src/app/**
  - src/styles/**
acceptance:
  - Four shell compositions consume frozen view models without routing or provider/FHIR SDK ownership
  - Needs-attention state cannot render as Ready
  - Trace request/output updates one expandable row and resets expansion on authorized context replacement
  - Uncertain identity exception contains a safe session label, owner, deadline, and acknowledgment state without patient PHI
  - Physician next visit is suggested but requires an explicit Open visit or Enter action
  - Loading, empty, error, forbidden, blocked, stale, provider-label, and fixed safety-stop presentations are available
  - Keyboard and accessibility behavior uses named controls, J/K/E/Enter, Ctrl/Cmd+K, focus return, ARIA live updates, text/symbol status cues, reduced motion, and patient target sizing
verification:
  - npm test -- src/ui
  - npm run typecheck
  - npm run lint
  - npm test
  - npm run build
merge_gate:
  - Only src/ui/** and handoffs/ui/** changed
  - All repository checks green
---

## Outcome

Implemented view-only, callback-driven public access, Synthetic Demo Access, patient workspace, and physician cockpit compositions. Added reusable Ready Visit Rail, exception inbox, surface-state panel, shell frame, and compact expandable function trace group. Components consume root `ReadyVisitVM`, `TracePresentation`, and `DEMO_V1`; they do not derive workflow authorization or mutate FHIR.

## Owned files changed

- `src/ui/view-models.ts`
- `src/ui/fixtures/presentation.ts`
- `src/ui/ui.css`
- `src/ui/components/**`
- `src/ui/shells/**`
- `src/ui/__tests__/**`
- `handoffs/ui/wave1.md`

## RED evidence

Initial scaffold RED:

```text
Command: npm test -- src/ui
Expected: the new component suites fail because the UI modules do not yet exist.
Observed: 9 failed suites; imports for the four shells, ReadyVisitRail,
FunctionTraceGroup, ExceptionInbox, and presentation fixtures could not resolve.
```

Behavioral follow-up RED after modules existed:

```text
Command: npm test -- src/ui/__tests__/function-trace-group.test.tsx src/ui/__tests__/physician-cockpit-shell.test.tsx
Expected: trace details must expose safe start/completion timestamps; Ctrl+K must open
the physician command palette and Escape must restore cockpit focus.
Observed: 2 intended assertion failures: no Started timestamp and no Command palette dialog.
```

## GREEN evidence

```text
npm test -- src/ui
9 test files passed; 20 tests passed.

npm run typecheck
passed

npm run lint
passed

npm test
12 test files passed; 32 tests passed.

npm run build
passed; Vite production bundle and server TypeScript build completed.

git diff --check
passed
```

## Refactor performed

- Consolidated actor branding and persistent synthetic labeling in `ShellFrame`.
- Consolidated non-ready presentation in `SurfaceStatePanel` so stale data is never rendered behind error/forbidden/loading states.
- Kept trace expansion keyed by both context and trace ID, avoiding effect-driven state reset and making role/session replacement clear presentation state immediately.
- Kept status meaning textual and symbolic rather than color-dependent.
- Removed a second-patient presentation fixture to preserve the single-Maria MVP.

## Manual verification

- Exercised typed front-desk submission and member-ID submission through user-event tests.
- Exercised trace expansion during an in-place running-to-completed rerender and verified focus/expansion stability.
- Exercised J/K/E/Enter and Ctrl+K/Escape keyboard behavior, including focus return.
- Inspected rendered DOM for persistent synthetic labeling, fixed safety copy, absence of patient internal resource references, and source/provenance timestamps.
- Concrete palette and visual screenshots intentionally remain deferred until visual-direction approval and root shell composition.

## Remaining risks

- Root `TracePresentation` currently exposes `queued`, `running`, `succeeded`, `failed`, `blocked`, and `reconciling`. It does not yet represent the documented `awaiting-confirmation` or `cancelled` states, so the UI cannot render them without a root-owned contract revision.
- Components are not connected to root routing, sessions, trace transport, or Medplum repositories in this lane; root integration must supply only validated view models and callbacks.
- The CSS contains structural layout, semantic class names, `currentColor`, focus, responsive, reduced-motion, and target-size rules only. Concrete palette values remain intentionally absent.
- No screenshot is attached because root route composition and an approved palette do not yet exist.

## Requested contract change

Before the documented awaiting-confirmation/cancelled trace states are integrated, root should extend the frozen trace presentation schema and its positive/negative tests. This lane did not widen the shared contract.
