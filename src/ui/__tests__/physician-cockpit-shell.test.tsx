import { fireEvent, render, screen } from '@testing-library/react';
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

  it('opens the command palette with Ctrl+K and returns focus on Escape', () => {
    render(
      <PhysicianCockpitShell
        state="ready"
        visits={physicianVisits}
        exceptions={[]}
        onOpenVisit={vi.fn()}
        onAcknowledgeException={vi.fn()}
      />,
    );
    const workspace = screen.getByRole('application', { name: 'Physician cockpit' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
    expect(workspace).toHaveFocus();
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
