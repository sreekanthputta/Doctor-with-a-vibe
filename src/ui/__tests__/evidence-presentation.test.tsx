import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvidenceInspector } from '../components/EvidenceInspector';
import { physicianVisits } from '../fixtures/presentation';
import {
  buildEvidenceSourceModes,
  mapPersistedResourceEvidence,
  projectPersistedWorkflowEvidence,
} from '../mappers/evidence-presentation';
import './test-cleanup';

describe('persisted evidence presentation', () => {
  it('preserves the exact persisted reference, version, timestamp, and workflow role', () => {
    const evidence = mapPersistedResourceEvidence({
      resourceType: 'Appointment',
      reference: 'Appointment/2f47d2b7-2ef5-4cc4-bada-705190df49f1',
      version: '17',
      sourceUpdatedAt: '2026-08-01T20:14:31.472Z',
      workflowRole: 'Scheduling',
    });

    expect(evidence).toMatchObject({
      reference: 'Appointment/2f47d2b7-2ef5-4cc4-bada-705190df49f1',
      versionId: '17',
      sourceTimestamp: '2026-08-01T20:14:31.472Z',
      workflowRole: 'booking-record',
      workflowRoleLabel: 'Scheduling',
    });
    expect(evidence.businessIdentifier).toBeUndefined();
  });

  it('labels deterministic conversation separately from live Medplum persistence', () => {
    const sourceModes = buildEvidenceSourceModes({
      conversation: 'deterministic-typed',
      persistence: 'medplum-live',
    });
    const visit = {
      ...physicianVisits[0],
      sourceModes,
      evidenceResources: [mapPersistedResourceEvidence({
        resourceType: 'CoverageEligibilityResponse',
        reference: 'CoverageEligibilityResponse/live-response-98',
        version: '4',
        sourceUpdatedAt: '2026-08-01T20:16:02.009Z',
        workflowRole: 'Eligibility evidence',
      })],
    };

    render(<EvidenceInspector visit={visit} />);

    const sourceSummary = screen.getByRole('group', { name: 'Workflow source modes' });
    expect(within(sourceSummary).getByText('Deterministic typed conversation')).toBeInTheDocument();
    expect(within(sourceSummary).getByText('Medplum live committed resources')).toBeInTheDocument();
    expect(within(sourceSummary).queryByText(/Medplum fixture conversation/i)).not.toBeInTheDocument();

    const evidence = screen.getByRole('region', { name: 'Medplum workflow evidence' });
    expect(within(evidence).getByText('CoverageEligibilityResponse/live-response-98')).toBeInTheDocument();
    expect(within(evidence).getByText('Version 4')).toBeInTheDocument();
    expect(within(evidence).getByText('2026-08-01T20:16:02.009Z')).toBeInTheDocument();
    expect(within(evidence).queryByText('Business identifier')).not.toBeInTheDocument();
  });

  it('labels fixture persistence without implying that the conversation used Medplum', () => {
    expect(buildEvidenceSourceModes({
      conversation: 'deterministic-typed',
      persistence: 'medplum-fixture',
    })).toEqual({
      conversation: {
        mode: 'deterministic-typed',
        label: 'Deterministic typed conversation',
      },
      persistence: {
        mode: 'medplum-fixture',
        label: 'Deterministic Medplum-shaped fixture',
      },
    });
  });

  it('keeps fixture eligibility labeled as fixture when persistence is live Medplum', () => {
    const projection = projectPersistedWorkflowEvidence({
      evidence: [
        { resourceType: 'Coverage', reference: 'Coverage/live-c', version: '9', sourceUpdatedAt: '2026-08-01T20:20:00.000Z', workflowRole: 'Coverage' },
        { resourceType: 'Task', reference: 'Task/live-t', version: '6', sourceUpdatedAt: '2026-08-01T20:20:03.000Z', workflowRole: 'Owned exception' },
        { resourceType: 'CoverageEligibilityRequest', reference: 'CoverageEligibilityRequest/live-rq', version: '2', sourceUpdatedAt: '2026-08-01T20:20:01.000Z', workflowRole: 'Eligibility input' },
        { resourceType: 'CoverageEligibilityResponse', reference: 'CoverageEligibilityResponse/live-rs', version: '3', sourceUpdatedAt: '2026-08-01T20:20:02.000Z', workflowRole: 'Eligibility evidence', sourceIdentifier: 'fixture:demo-v1:eligibility:maria' },
      ],
      conversation: 'deterministic-typed',
      persistence: 'medplum-live',
      workflowStatus: 'ready',
      taskOwnerDisplay: 'Dr. Maya Chen',
    });

    expect(projection.resolvedTaskHistory).toMatchObject({
      reference: 'Task/live-t',
      versionId: '6',
      sourceTimestamp: '2026-08-01T20:20:03.000Z',
    });
    expect(projection.eligibilityLinkage).toEqual({
      requestReference: 'CoverageEligibilityRequest/live-rq',
      responseReference: 'CoverageEligibilityResponse/live-rs',
      coverageReference: 'Coverage/live-c',
      sourceTimestamp: '2026-08-01T20:20:02.000Z',
      transactionState: 'completed',
      providerMode: 'fixture',
      sourceIdentifier: 'fixture:demo-v1:eligibility:maria',
      summary: 'Request → Response → Coverage',
    });

    const visit = { ...physicianVisits[0], ...projection };
    render(<EvidenceInspector visit={visit} />);
    const linkage = screen.getByRole('region', { name: 'Eligibility evidence linkage' });
    expect(within(linkage).getByText('Completed · fixture')).toBeInTheDocument();
    expect(within(linkage).getByText('fixture:demo-v1:eligibility:maria')).toBeInTheDocument();
  });
});
