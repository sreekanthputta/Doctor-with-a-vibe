import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublicAccessShell } from '../shells/public-access/PublicAccessShell';
import { PatientWorkspaceShell } from '../shells/patient-workspace/PatientWorkspaceShell';
import { needsAttentionVisit } from '../fixtures/presentation';
import './test-cleanup';

describe('UI accessibility contract', () => {
  it('uses landmarks, persistent synthetic labeling, and named controls', () => {
    render(
      <PublicAccessShell
        state="ready"
        providerMode="fixture"
        traceContextKey="public:session-a"
        traces={[]}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('DEMO · SYNTHETIC DATA')).toBeInTheDocument();
    expect(screen.getByLabelText('Message the front desk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send request' })).toHaveClass('patient-target');
  });

  it('uses text and symbols in addition to status color', () => {
    render(
      <PatientWorkspaceShell
        state="ready"
        visit={needsAttentionVisit}
        onSubmitMemberId={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Needs attention visit')).toHaveTextContent('!');
    expect(screen.getByRole('button', { name: 'Submit member ID' })).toHaveClass('patient-target');
  });
});
