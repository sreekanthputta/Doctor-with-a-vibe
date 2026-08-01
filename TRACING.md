# VibeDoc Function Trace UI Contract

> Normative priority: subordinate to `AGENTS.md`, `HACKATHON.md`, and `ARCHITECTURE.md`. This is user-visible execution provenance, not model chain-of-thought, FHIR `Provenance`, or a security audit log.

## Experience

After an assistant message requests or completes tools, render a compact trace group directly beneath that message, similar to a modern agent chat:

```text
Found two Tuesday appointments.

⌄ 3 actions
  ✓ Search availability       182 ms
  ✓ Apply scheduling policy    11 ms
  ● Hold 9:30 appointment     running
```

Each row is keyboard-focusable and clickable. Opening it reveals a compact inline panel or right-side drawer:

```text
Hold appointment                         running

Status
queued  10:02:41.102
running 10:02:41.118

Input (sanitized)
{
  "slot": "Tue Aug 4 · 9:30 AM",
  "visitType": "adult-annual-wellness"
}

Output
Waiting for scheduling adapter…
```

When the result arrives, the same panel updates in place:

```text
completed 10:02:41.441 · 323 ms

Output (sanitized)
{
  "status": "held",
  "expiresAt": "10:07 AM",
  "source": "Medplum live"
}
```

Do not append a second disconnected trace row for the response. Correlate and update the original item by VibeDoc trace ID and provider function-call ID.

## Event model

```ts
type TraceStatus =
  | 'queued'
  | 'running'
  | 'awaiting-confirmation'
  | 'reconciling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

type TraceEvent = {
  traceId: string;
  serverSessionId: string;
  role: 'public-booking' | 'patient-demo' | 'physician-demo';
  subjectPersona: string;
  messageId: string;
  functionCallId?: string;
  functionName: string;
  displayName: string;
  status: TraceStatus;
  sequence: number;
  occurredAt: string;
  durationMs?: number;
  providerMode: 'live' | 'fixture' | 'prerecorded';
  input?: SanitizedTraceValue;
  output?: SanitizedTraceValue;
  error?: SafeTraceError;
};
```

The server derives `serverSessionId`, `role`, and `subjectPersona`; the client cannot supply or modify them. The dispatcher emits monotonic events. The UI reducer namespaces each item by `(serverSessionId, role, subjectPersona, traceId, functionCallId)`, rejects mismatched, out-of-order, or duplicate events, preserves the last terminal state, and shows reconnect/stale status explicitly. Replacing a session, role, or persona immediately clears the prior trace store and expanded/copy state. Read calls may overlap; dependent mutations retain the deterministic workflow order even if Deepgram requested an array.

For mutations, `completed` means the validated FHIR transaction response and persisted resource versions/expected `Provenance` targets have been confirmed. If dispatch occurred but the response was lost—or shutdown begins after dispatch—the item becomes `reconciling`, not `failed` or `cancelled`. The gateway checks the application idempotency identifier against Medplum before retrying. It then resolves to `completed`, confirmed `failed · no mutation committed`, or `blocked · outcome unknown — review authoritative record`. Never retry an ambiguous mutation merely because its trace event was lost.

## Real-time transport

- Browser-handled UI/tool events update the local trace store immediately.
- Server-handled tools publish sanitized events from the Railway gateway over a server-authorized Server-Sent Events endpoint bound to the current session ID, role, and allowlisted synthetic subject/persona. The client cannot choose or broaden those bindings.
- The UI merges both streams only within the immutable server-authorized `(serverSessionId, role, subjectPersona)` context, then by `traceId` and `functionCallId`.
- Reconnect uses `Last-Event-ID`/sequence where supported; otherwise it requests the current sanitized trace snapshot under the same server-derived session, role, and subject binding. Stream/snapshot access expires with the role-bound session.
- Closing/revoking a voice session cancels pending trace items and late provider events cannot reopen or mutate them.
- The trace stream is operational UI state. It is not the authority for workflow completion; the UI re-reads Medplum-derived view state.

## Visibility and redaction

Public and patient surfaces show friendly action names and minimum safe values, for example `Checking appointment times` rather than an unrestricted internal tool name. Physician Synthetic Demo Access may show richer synthetic inputs, FHIR resource types/IDs, provider mode, timing, and normalized outputs.

Never render or stream:

- API keys, authorization headers, cookies, session tokens, credentials, or signed URLs;
- hidden prompts, model reasoning, chain-of-thought, `thought_signature`, or provider-internal metadata;
- raw audio, full transcripts, arbitrary FHIR narrative, uploaded documents, or raw provider payloads;
- fields outside the tool-specific trace-output allowlist;
- real PHI in the hackathon.

Input/output must pass a runtime trace schema and explicit field allowlist after the tool boundary. Generic recursive “remove keys named secret” filtering is insufficient. Errors show safe codes and retry state, not stack traces or vendor payloads.

## Interaction rules

- Rows appear below the assistant message that initiated or summarized the work.
- Running rows animate subtly and honor reduced-motion settings.
- New output updates are announced with a polite ARIA live region.
- Expanded state survives updates; focus does not jump when output arrives.
- JSON has formatted and copy views; copy uses the sanitized value only.
- Show `live`, `fixture`, or `prerecorded` on every terminal result.
- Mutations show `awaiting confirmation` before execution when policy requires it.
- Failed/blocked rows state whether anything changed. `Failed · no mutation committed` is preferred.
- Trace labels never claim coverage, external delivery, clinical approval, or workflow completion beyond the returned evidence.

## Relationship to evidence

| Artifact | Purpose | Durable authority |
| --- | --- | --- |
| Function trace | explain current execution to the user | no |
| Medplum resource | workflow/clinical state | yes, within its scope |
| FHIR `Provenance` | lineage of committed resource versions | yes, for recorded lineage |
| Sanitized application security event | security decision metadata | separate evidence, not PHI payload |
| Provider transaction | external payer/speech response | provider at its timestamp, synchronized as designed |

## Required tests

- Multiple functions in one request correlate to the correct rows and responses.
- A running row updates in place when output arrives while expanded.
- Out-of-order, repeated, or late events cannot regress terminal state.
- Mutation traces follow deterministic order and idempotency; repeated events cause no duplicate write.
- Commit-then-drop-response and `SIGTERM`-after-commit each reconcile to one resource graph and one version-specific Provenance lineage without a duplicate mutation or false failed trace.
- Cross-role trace stream access returns `401/403`.
- Same-role cross-session or cross-persona trace stream/snapshot access returns `401/403`, including guessed trace IDs and stale/expired sessions.
- A same-SPA public → patient → physician → patient route/session switch clears old trace state; colliding IDs cannot merge and richer prior output cannot remain expanded or copyable.
- Public/patient traces never expose internal IDs or disallowed values.
- Physician demo traces expose only allowlisted synthetic fields.
- Secrets, headers, prompts, `thought_signature`, raw provider payloads, and stack traces never render.
- Voice revocation cancels active items and late function events cannot mutate state.
- SSE reconnect restores the current sanitized snapshot without duplicating rows.
- Fixture/live labels remain accurate during provider outage and fallback.
