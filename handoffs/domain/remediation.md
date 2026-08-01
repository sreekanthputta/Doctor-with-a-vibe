# Domain safety remediation handoff

## Outcome

- Replaced substring-based scripted interpretation with an anchored full-turn allowlist.
- Preserved the exact original text in the in-memory conversation decision without copying it into the exception command.
- Classified rejected text as `administrative-unmatched`, `clinical-language`, or `mixed-clinical-administrative`.
- Produced exactly one idempotent generic `create-exception` command and no booking command for every stop.
- Restricted the fixed emergency copy to clinical and mixed-language stops; all other stops use neutral copy.
- Bound exception ownership and the Maria business identifier to the shared `DEMO_V1` fixture.

## RED evidence

Command:

```bash
npm test -- src/domain/__tests__/administrative-grammar.test.ts src/domain/__tests__/exception-policy.test.ts src/domain/__tests__/identity-gate.test.ts tests/integration/provider-fixtures.test.ts
```

Expected assertion/API failures after dependencies were installed: 21 failed, 11 passed. The failures specifically showed the missing full-text evaluator/adapter decision, the old `create-identity-exception` type and owner, and emergency copy being used for nonclinical stops.

## GREEN evidence

Targeted command: 4 files passed, 32 tests passed.

Lane command:

```bash
npm test -- src/domain tests/integration/provider-fixtures.test.ts
```

Result: 9 files passed, 51 tests passed.

Repository merge gate:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Result: typecheck passed; lint passed; 35 files and 124 tests passed; production client and server build passed.

## Remaining risk

The closed scripted grammar intentionally recognizes only the frozen annual-wellness demo phrases. New wording must be added test-first as an explicit practice-policy decision; broad fuzzy matching would reopen the safety defect.
