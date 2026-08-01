import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhysicianCockpitShell } from '../shells/physician-cockpit/PhysicianCockpitShell';
import { physicianVisits, uncertainIdentityException } from '../fixtures/presentation';
import './test-cleanup';

describe('PhysicianCockpitShell', () => {
  it('suggests the next appointment but requires Enter or Open visit to inspect it', async () => {
    const user = userEvent.setup();
    const onOpenVisit = vi.fn();
    render(
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[]}
        onOpenVisit={onOpenVisit}
        onAcknowledgeException={vi.fn()}
      />,
    );

    expect(screen.getByText('Suggested next visit')).toBeInTheDocument();
    expect(onOpenVisit).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onOpenVisit).toHaveBeenCalledWith('demo-v1:appointment:maria-wellness');
  });

  it('supports J/K navigation and E to open the exception queue', async () => {
    const user = userEvent.setup();
    render(
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[uncertainIdentityException]}
        onOpenVisit={vi.fn()}
        onAcknowledgeException={vi.fn()}
      />,
    );
    const workspace = screen.getByRole('application', { name: 'Physician cockpit' });
    workspace.focus();
    await user.keyboard('j');
    expect(screen.getByText('Maria Lopez', { selector: '[aria-current="true"] *' })).toBeInTheDocument();
    await user.keyboard('k');
    expect(screen.getByText('Maria Lopez', { selector: '[aria-current="true"] *' })).toBeInTheDocument();
    await user.keyboard('e');
    expect(screen.getByRole('heading', { name: 'Exceptions' })).toBeInTheDocument();
  });

  it('keeps the evidence inspector dominant while the command palette is deferred', () => {
    render(
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[]}
        onOpenVisit={vi.fn()}
        onAcknowledgeException={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Medplum workflow evidence' })).toBeInTheDocument();
  });

  it('shows allowlisted versioned workflow evidence instead of resource-type strings', () => {
    render(
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[]}
        onOpenVisit={vi.fn()}
        onAcknowledgeException={vi.fn()}
      />,
    );

    const evidence = screen.getByRole('region', { name: 'Medplum workflow evidence' });
    expect(within(evidence).getByText('Appointment/appt-maria-wellness')).toBeInTheDocument();
    expect(within(evidence).getByText('demo-v1:appointment:maria-wellness')).toBeInTheDocument();
    expect(within(evidence).getAllByText('Version 1').length).toBeGreaterThan(0);
    expect(within(evidence).getByText('Booking record')).toBeInTheDocument();
    expect(within(evidence).getByText('Created from the selected 10:30 slot for this workflow.')).toBeInTheDocument();
    expect(within(evidence).queryByRole('heading', { name: 'Medplum resource types' })).not.toBeInTheDocument();
  });

  it('makes the resolved Task and eligibility evidence chain explicit', () => {
    render(
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[]}
        onOpenVisit={vi.fn()}
        onAcknowledgeException={vi.fn()}
      />,
    );

    const taskHistory = screen.getByRole('region', { name: 'Resolved Task history' });
    expect(within(taskHistory).getByText('Completed')).toBeInTheDocument();
    expect(within(taskHistory).getByText('Task/task-member-id')).toBeInTheDocument();
    expect(within(taskHistory).getByText(/member ID supplied/i)).toBeInTheDocument();

    const linkage = screen.getByRole('region', { name: 'Eligibility evidence linkage' });
    expect(within(linkage).getByText('CoverageEligibilityRequest/eligibility-request-maria')).toBeInTheDocument();
    expect(within(linkage).getByText('CoverageEligibilityResponse/eligibility-response-maria')).toBeInTheDocument();
    expect(within(linkage).getByText('Coverage/coverage-maria')).toBeInTheDocument();
    expect(within(linkage).getByText('Request → Response → Coverage')).toBeInTheDocument();
    expect(within(linkage).getByText('Completed · fixture')).toBeInTheDocument();
  });

  it('labels sanitized security evidence separately from FHIR Provenance', () => {
    render(
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[]}
        onOpenVisit={vi.fn()}
        onAcknowledgeException={vi.fn()}
      />,
    );

    const securityEvent = screen.getByRole('region', { name: 'Sanitized application security event' });
    expect(within(securityEvent).getByText('Allowed')).toBeInTheDocument();
    expect(within(securityEvent).getByText('physician-demo')).toBeInTheDocument();
    expect(within(securityEvent).getByText('Synthetic fixture')).toBeInTheDocument();
    expect(within(securityEvent).getByText('Not FHIR Provenance or a Medplum access audit.')).toBeInTheDocument();
  });

  it('renders loading, empty, error, and forbidden states without stale visit data', () => {
    const props = {
      visits: physicianVisits,
      exceptions: [uncertainIdentityException],
      onOpenVisit: vi.fn(),
      onAcknowledgeException: vi.fn(),
    };
    const { rerender } = render(<PhysicianCockpitShell {...props} state="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading physician workspace');
    expect(screen.queryByText('Maria Lopez')).not.toBeInTheDocument();

    rerender(<PhysicianCockpitShell {...props} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load the physician workspace.');
    expect(screen.queryByText('Maria Lopez')).not.toBeInTheDocument();

    rerender(<PhysicianCockpitShell {...props} state="forbidden" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Physician access is required.');
    expect(screen.queryByText('Maria Lopez')).not.toBeInTheDocument();

    rerender(<PhysicianCockpitShell {...props} state="empty" />);
    expect(screen.getByText('No scheduled visits')).toBeInTheDocument();
  });
});
