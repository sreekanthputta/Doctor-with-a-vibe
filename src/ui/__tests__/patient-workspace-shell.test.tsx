import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PatientWorkspaceShell } from '../shells/patient-workspace/PatientWorkspaceShell';
import { needsAttentionVisit, readyVisit } from '../fixtures/presentation';
import './test-cleanup';

describe('PatientWorkspaceShell', () => {
  it('requests the missing member ID and never exposes internal identifiers', async () => {
    const user = userEvent.setup();
    const onSubmitMemberId = vi.fn();
    render(
      <PatientWorkspaceShell
        state="ready"
        visit={needsAttentionVisit}
        onSubmitMemberId={onSubmitMemberId}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Insurance member ID required' })).toBeInTheDocument();
    expect(screen.getByText('Eligibility has not run yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Appointment\//)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Insurance member ID'), 'AETNA-DEMO-2048');
    await user.click(screen.getByRole('button', { name: 'Submit member ID' }));
    expect(onSubmitMemberId).toHaveBeenCalledWith('AETNA-DEMO-2048');
  });

  it('locks member-ID submission while the first request is pending', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => { resolveSubmit = resolve; });
    const onSubmitMemberId = vi.fn(() => pending);
    render(
      <PatientWorkspaceShell
        state="ready"
        visit={needsAttentionVisit}
        onSubmitMemberId={onSubmitMemberId}
      />,
    );

    await user.type(screen.getByLabelText('Insurance member ID'), 'AETNA-DEMO-2048');
    await user.click(screen.getByRole('button', { name: 'Submit member ID' }));
    const pendingButton = screen.getByRole('button', { name: 'Submitting…' });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(onSubmitMemberId).toHaveBeenCalledOnce();
    resolveSubmit();
  });

  it('shows payer language, source time, and confirmed provenance when ready', () => {
    render(
      <PatientWorkspaceShell state="ready" visit={readyVisit} onSubmitMemberId={vi.fn()} />,
    );

    expect(screen.getByText('Response received')).toBeInTheDocument();
    expect(screen.getByText('Unknown / not checked')).toBeInTheDocument();
    expect(screen.getByText(/Source updated/i)).toBeInTheDocument();
    expect(screen.getByText('Provenance confirmed')).toBeInTheDocument();
    expect(screen.queryByText(/covered/i)).not.toBeInTheDocument();
  });
});
