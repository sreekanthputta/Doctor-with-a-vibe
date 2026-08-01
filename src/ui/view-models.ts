import type { ReadyVisitVM } from '../contracts/ready-visit';
import type { TracePresentation } from '../contracts/trace';

export type SurfaceState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'blocked'
  | 'stale';

export type PublicSurfaceState = SurfaceState | 'stopped';
export type ProviderMode = 'live' | 'fixture' | 'prerecorded';
export type DemoPersona = 'maria-demo' | 'maya-demo';

export type ExceptionVM = Readonly<{
  id: string;
  category: 'identity' | 'scheduling' | 'intake' | 'coverage' | 'clinical-language' | 'provider-failure';
  safeSubjectLabel: string;
  ownerDisplay: string;
  dueAt: string;
  status: 'requested' | 'accepted' | 'in-progress';
  acknowledged: boolean;
  reason: string;
}>;

export type PhysicianVisitVM = ReadyVisitVM &
  Readonly<{
    sourceLabel: string;
    resources: readonly string[];
  }>;

export type TraceVM = TracePresentation &
  Readonly<{
    displayName: string;
    providerMode: ProviderMode;
    durationMs?: number;
  }>;
