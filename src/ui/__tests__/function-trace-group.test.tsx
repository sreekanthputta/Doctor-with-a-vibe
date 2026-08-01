import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FunctionTraceGroup } from '../components/FunctionTraceGroup';
import { bookingTrace, completedBookingTrace } from '../fixtures/presentation';
import './test-cleanup';

describe('FunctionTraceGroup', () => {
  it('expands sanitized details and updates the same row in place', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FunctionTraceGroup contextKey="public:session-a" traces={[bookingTrace]} />,
    );

    await user.click(screen.getByRole('button', { name: /Book appointment.*running/i }));
    expect(screen.getByText('Tuesday, August 4 · 10:30 AM')).toBeInTheDocument();
    expect(screen.getByText('Waiting for scheduling adapter…')).toBeInTheDocument();

    rerender(
      <FunctionTraceGroup contextKey="public:session-a" traces={[completedBookingTrace]} />,
    );

    expect(screen.getAllByRole('button', { name: /Book appointment/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Book appointment.*completed/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Appointment recorded')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Book appointment completed');
    expect(screen.getByText('fixture')).toBeInTheDocument();
    expect(screen.getByText(/Started:/)).toBeInTheDocument();
    expect(screen.getByText(/Completed:/)).toBeInTheDocument();
  });

  it('renders blocked outcomes without claiming a mutation succeeded', async () => {
    const user = userEvent.setup();
    const blocked = { ...bookingTrace, status: 'blocked' as const };
    render(<FunctionTraceGroup contextKey="patient:session-a" traces={[blocked]} />);

    await user.click(screen.getByRole('button', { name: /Book appointment.*blocked/i }));
    expect(screen.getByText('Blocked · no change confirmed')).toBeInTheDocument();
  });
});
