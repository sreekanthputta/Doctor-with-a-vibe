import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PublicAccessShell } from '../shells/public-access/PublicAccessShell';
import { bookingTrace } from '../fixtures/presentation';
import './test-cleanup';

describe('PublicAccessShell', () => {
  it('discloses automation and offers an equivalent typed path', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PublicAccessShell
        state="ready"
        providerMode="fixture"
        traceContextKey="public:session-a"
        traces={[bookingTrace]}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('One request. One ready visit.')).toBeInTheDocument();
    expect(screen.getByText(/automated administrative assistant/i)).toBeInTheDocument();
    expect(screen.getByText('Synthetic deterministic FHIR fixture')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Message the front desk'), 'Book an annual wellness visit');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(onSubmit).toHaveBeenCalledWith('Book an annual wellness visit');
  });

  it('shows the fixed safety stop copy without personalized advice', () => {
    render(
      <PublicAccessShell
        state="stopped"
        providerMode="fixture"
        traceContextKey="public:session-a"
        traces={[]}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'VibeDoc cannot assess symptoms or emergencies. Do not wait for a reply. If you may be experiencing an emergency, call 911 or your local emergency number now. For other clinical concerns, contact a qualified healthcare professional.',
    );
    expect(screen.getByText('Clinical content received — not assessed')).toBeInTheDocument();
  });

  it('does not expose stale content in forbidden and error states', () => {
    const { rerender } = render(
      <PublicAccessShell
        state="forbidden"
        providerMode="fixture"
        traceContextKey="public:session-a"
        traces={[bookingTrace]}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This demo session cannot access that workspace.');
    expect(screen.queryByText('Book appointment')).not.toBeInTheDocument();

    rerender(
      <PublicAccessShell
        state="error"
        providerMode="fixture"
        traceContextKey="public:session-a"
        traces={[bookingTrace]}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The front desk is temporarily unavailable.');
    expect(screen.queryByText('Book appointment')).not.toBeInTheDocument();
  });
});
