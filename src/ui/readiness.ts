import type { ReadyVisitVM } from '../contracts/ready-visit';

export function isVisitReady(visit: ReadyVisitVM): boolean {
  return visit.status === 'ready'
    && visit.openRequiredTaskCount === 0
    && visit.eligibilityTransaction === 'completed';
}
