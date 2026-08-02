# Domain stage and safety remediation

```yaml
id: OP-102-stage-safety
outcome: Accept the exact rehearsed request while conservatively stopping unestablished clinical text
owner: lane/domain
state: review
dependencies:
  - Frozen AdministrativeIntent contract
  - Frozen 2026-08-04 demo appointment date
owned_paths:
  - src/domain/**
  - handoffs/domain/**
forbidden_paths:
  - src/contracts/**
  - src/test/fixtures/**
  - src/fhir/**
  - src/ui/**
  - src/server/**
  - src/app/**
  - tests/integration/**
  - tests/e2e/**
  - package.json
  - package-lock.json
acceptance:
  - The exact HACKATHON.md stage utterance becomes the bounded annual-wellness scheduling intent
  - Unestablished symptom-bearing text produces the exact fixed safety copy
  - Mixed administrative and unestablished clinical text produces the same fixed safety copy
  - Administrative misspellings and negations remain stopped and do not schedule
verification:
  - npm test -- src/domain
  - npm run typecheck
  - npm run lint
  - npm test
  - npm run build
merge_gate:
  - Green domain suite
  - Green repository regression suite and production build
  - No files outside the owned paths staged
```

## Outcome

Added one explicit full-turn allowlist entry for the documented stage sentence:

`I’m a new patient. I want an annual wellness visit next Tuesday morning and I have Aetna.`

It yields only the bounded `annual-wellness-request` intent for `2026-08-04` in the morning. The additional words do not independently bind an identity, persist coverage, or broaden authority. Those values remain subject to the later dedicated workflow steps.

Free text without established administrative language now fails closed as `clinical-language`. A rejected compound administrative turn using `and`, `because`, `but`, or `since` is treated conservatively as mixed language. Both paths use the exact fixed, non-personalized safety copy and create one requested exception command. Known administrative misspellings and negations retain their neutral stopped state.

## Owned files changed

- `src/domain/administrative-grammar.ts`
- `src/domain/__tests__/administrative-grammar.test.ts`
- `handoffs/domain/stage-safety-remediation.md`

## RED evidence

First command:

```bash
npm test -- src/domain/__tests__/administrative-grammar.test.ts src/domain/__tests__/exception-policy.test.ts
```

Expected failing assertions: the documented stage sentence should continue as the bounded dated request, and two unestablished symptom-bearing turns should stop as clinical language.

Observed RED: 3 assertion failures. The stage sentence returned `administrative-unmatched`; `Something is wrong with me` and `My stomach keeps cramping` also returned `administrative-unmatched` instead of `clinical-language`.

Second command after the first minimal change:

```bash
npm test -- src/domain/__tests__/administrative-grammar.test.ts
```

Expected failing assertion: a compound administrative request with unestablished clinical wording must use the mixed-language stop path.

Observed RED: 1 assertion failure. `Book an annual wellness visit because something is wrong with me` returned `administrative-unmatched` instead of `mixed-clinical-administrative`.

## GREEN evidence

```text
npm test -- src/domain
  8 files passed; 46 tests passed

npm run typecheck
  passed

npm run lint
  passed

npm test
  40 files passed, 2 skipped; 169 tests passed, 2 skipped

npm run build
  strict TypeScript, client production build, and server SSR build passed

git diff --check
  passed
```

## Refactor performed

- Kept the canonical stage sentence as an anchored, full-turn rule instead of broadening the natural-language grammar.
- Kept conservative classification separate from fixed-copy construction; `exception-policy.ts` remains the single copy source.
- Preserved the original input only in caller-owned decision state, never in the exception command.

## Manual verification

The tests verify the exact documented curly-apostrophe sentence, preserve the original text, and return the frozen dated scheduling intent. The same anchored rule accepts an ASCII apostrophe for typed input. Negative tests verify no booking command appears in vague symptom, compound mixed, misspelled, or negated stop outcomes.

## Remaining risk

The v1 text evaluator is deliberately a rehearsed-demo grammar, not a general clinical-language classifier. Benign unmatched text can be escalated conservatively, and compound language can be over-classified as mixed. Production requires a reviewed intake design and deterministic safety policy; this implementation does not claim triage or symptom understanding.

## Requested contract change

None.
