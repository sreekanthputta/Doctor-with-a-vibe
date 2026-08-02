import { TracePresentationSchema, type TracePresentation } from '../contracts/trace.js';
import type { SessionContext } from '../contracts/session.js';

type Role = SessionContext['role'];

type StartTrace = {
  sessionId: string;
  role: Role;
  traceId: string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
};

type InternalTrace = TracePresentation & { sessionId: string; role: Role };

const projections: Record<string, { input: readonly string[]; output: readonly string[] }> = {
  book_appointment: { input: ['slotDisplay'], output: ['appointmentDisplay'] },
  get_ready_visit: { input: [], output: ['visitStatus', 'sourceUpdatedAt', 'provenanceState'] },
  save_intake: { input: ['completedFieldCount'], output: ['status', 'missingFieldCount'] },
  run_eligibility: { input: ['payerDisplay'], output: ['outcome', 'active', 'fieldsNotReturned'] },
};

export class TraceStore {
  readonly #traces = new Map<string, InternalTrace>();

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  start(command: StartTrace): TracePresentation {
    const projection = this.#projection(command.toolName);
    const trace = TracePresentationSchema.parse({
      traceId: command.traceId,
      messageId: command.messageId,
      toolName: command.toolName,
      status: 'running',
      startedAt: this.now(),
      safeInput: pick(command.input, projection.input),
    });
    this.#traces.set(this.#key(command.sessionId, command.traceId), { ...trace, sessionId: command.sessionId, role: command.role });
    return trace;
  }

  complete(sessionId: string, traceId: string, output: Record<string, unknown>): TracePresentation {
    return this.#finish(sessionId, traceId, 'succeeded', output);
  }

  block(sessionId: string, traceId: string, output: Record<string, unknown>): TracePresentation {
    return this.#finish(sessionId, traceId, 'blocked', output);
  }

  #finish(
    sessionId: string,
    traceId: string,
    status: 'succeeded' | 'blocked',
    output: Record<string, unknown>,
  ): TracePresentation {
    const key = this.#key(sessionId, traceId);
    const existing = this.#traces.get(key);
    if (!existing) throw new Error('Trace not found');
    const projection = this.#projection(existing.toolName);
    const updated = TracePresentationSchema.parse({
      traceId: existing.traceId,
      messageId: existing.messageId,
      toolName: existing.toolName,
      status,
      ...(existing.startedAt ? { startedAt: existing.startedAt } : {}),
      completedAt: this.now(),
      safeInput: existing.safeInput,
      safeOutput: pick(output, projection.output),
    });
    this.#traces.set(key, { ...updated, sessionId, role: existing.role });
    return updated;
  }

  snapshot(sessionId: string, role: Role): TracePresentation[] {
    const sessionTraces = [...this.#traces.values()].filter((trace) => trace.sessionId === sessionId);
    if (sessionTraces.some((trace) => trace.role !== role)) throw new Error('Trace role mismatch');
    return sessionTraces.map((trace) => ({
      traceId: trace.traceId,
      messageId: trace.messageId,
      toolName: trace.toolName,
      status: trace.status,
      ...(trace.startedAt ? { startedAt: trace.startedAt } : {}),
      ...(trace.completedAt ? { completedAt: trace.completedAt } : {}),
      ...(trace.safeInput ? { safeInput: trace.safeInput } : {}),
      ...(trace.safeOutput ? { safeOutput: trace.safeOutput } : {}),
    }));
  }

  clearSession(sessionId: string): void {
    for (const [key, trace] of this.#traces) {
      if (trace.sessionId === sessionId) this.#traces.delete(key);
    }
  }

  #projection(toolName: string): { input: readonly string[]; output: readonly string[] } {
    const projection = projections[toolName];
    if (!projection) throw new Error(`Trace projection is not configured for ${toolName}`);
    return projection;
  }

  #key(sessionId: string, traceId: string): string {
    return `${sessionId}:${traceId}`;
  }
}

function pick(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
}
