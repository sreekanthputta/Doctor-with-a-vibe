import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { parseDemoWorkflowSnapshot } from './demo-snapshot';
import { resolveShell } from './routes';

describe('route shells', () => {
  it.each([
    ['/', 'public'],
    ['/demo', 'demo'],
    ['/patient/visit', 'patient'],
    ['/physician/inbox', 'physician'],
  ] as const)('maps %s to the %s trust-domain shell', (path, expected) => {
    expect(resolveShell(path)).toBe(expected);
  });

  it('always labels the experience as synthetic', () => {
    render(<App />);
    expect(screen.getByText(/synthetic data/i)).toBeInTheDocument();
    expect(screen.getByText(/Powered by Medplum/i)).toBeInTheDocument();
  });

  it('rejects an inconsistent Ready visit at the client boundary', () => {
    expect(() => parseDemoWorkflowSnapshot({
      phase: 'ready',
      exceptions: [],
      resourceEvidence: [],
      identityVerified: true,
      providerMode: 'fixture',
      visit: {
        appointmentBusinessId: 'demo:appointment',
        patientDisplay: 'Maria Lopez',
        physicianDisplay: 'Dr. Maya Chen',
        startsAt: '2026-08-04T10:30:00-05:00',
        status: 'ready',
        openRequiredTaskCount: 1,
        eligibilityTransaction: 'completed',
        sourceUpdatedAt: '2026-08-01T15:10:00-05:00',
        provenanceState: 'confirmed',
      },
    })).toThrow(/Ready requires completed eligibility and no open required tasks/);
  });

  it('rejects malformed evidence at the client boundary', () => {
    expect(() => parseDemoWorkflowSnapshot({
      phase: 'empty',
      exceptions: [],
      resourceEvidence: [{ resourceType: 'Task', reference: '', version: '1', sourceUpdatedAt: 'not-a-date', workflowRole: 'Owned exception' }],
      identityVerified: false,
      providerMode: 'fixture',
    })).toThrow();
  });

  it('rejects Ready when persisted evidence is absent or ambiguous', () => {
    const visit = {
      appointmentBusinessId: 'demo:appointment',
      patientDisplay: 'Maria Lopez',
      physicianDisplay: 'Dr. Maya Chen',
      startsAt: '2026-08-04T10:30:00-05:00',
      status: 'ready',
      openRequiredTaskCount: 0,
      eligibilityTransaction: 'completed',
      sourceUpdatedAt: '2026-08-01T15:10:00-05:00',
      provenanceState: 'confirmed',
    } as const;
    const snapshot = {
      phase: 'ready', exceptions: [], resourceEvidence: [], identityVerified: true, providerMode: 'fixture', visit,
    } as const;
    expect(() => parseDemoWorkflowSnapshot(snapshot)).toThrow(/exactly one Appointment/);

    const required = ['Appointment', 'Coverage', 'QuestionnaireResponse', 'Task', 'CoverageEligibilityRequest']
      .map((resourceType) => ({
        resourceType,
        reference: `${resourceType}/demo`,
        version: '1',
        sourceUpdatedAt: '2026-08-01T15:10:00-05:00',
        workflowRole: 'Demo evidence',
      }));
    const response = {
      resourceType: 'CoverageEligibilityResponse',
      reference: 'CoverageEligibilityResponse/demo',
      version: '1',
      sourceUpdatedAt: '2026-08-01T15:10:00-05:00',
      workflowRole: 'Eligibility evidence',
      sourceIdentifier: 'fixture:demo-transaction',
    };
    const provenance = {
      resourceType: 'Provenance', reference: 'Provenance/demo', version: '1',
      sourceUpdatedAt: '2026-08-01T15:10:00-05:00', workflowRole: 'Version lineage',
    };
    expect(() => parseDemoWorkflowSnapshot({
      ...snapshot,
      resourceEvidence: [...required, response, { ...response, reference: 'CoverageEligibilityResponse/duplicate' }, provenance],
    })).toThrow(/exactly one CoverageEligibilityResponse/);
    expect(() => parseDemoWorkflowSnapshot({
      ...snapshot,
      resourceEvidence: [...required, { ...response, sourceIdentifier: 'unknown:demo' }, provenance],
    })).toThrow(/recognized eligibility source identifier/);
  });

  it('rejects snapshot phase and visit mismatch', () => {
    expect(() => parseDemoWorkflowSnapshot({
      phase: 'empty', exceptions: [], resourceEvidence: [], identityVerified: false, providerMode: 'fixture',
      visit: {
        appointmentBusinessId: 'demo:appointment', patientDisplay: 'Maria Lopez', physicianDisplay: 'Dr. Maya Chen',
        startsAt: '2026-08-04T10:30:00-05:00', status: 'needs-attention', openRequiredTaskCount: 1,
        eligibilityTransaction: 'not-run', sourceUpdatedAt: '2026-08-01T15:10:00-05:00', provenanceState: 'confirmed',
      },
    })).toThrow(/phase and visit presence must align/);
  });
});
