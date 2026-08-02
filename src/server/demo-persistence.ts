export type DemoIdentity = {
  givenName: string;
  familyName: string;
  birthDate: string;
  postalCode: string;
};

export type PersistedResourceEvidence = {
  resourceType: string;
  reference: string;
  version: string;
  sourceUpdatedAt: string;
  workflowRole: string;
  sourceIdentifier?: string;
};

export type DemoPersistenceSnapshot = {
  phase: 'needs-attention' | 'ready' | 'stopped';
  evidence: PersistedResourceEvidence[];
};

export interface DemoPersistence {
  start(identity: DemoIdentity): Promise<DemoPersistenceSnapshot>;
  complete(memberId: string): Promise<DemoPersistenceSnapshot>;
  recordUncertainIdentity(correlationId: string): Promise<DemoPersistenceSnapshot>;
  recordException(category: string, correlationId: string): Promise<DemoPersistenceSnapshot>;
  acknowledgeException(): Promise<DemoPersistenceSnapshot>;
  reset(): Promise<{ deletedCount: number; verified: true }>;
}
