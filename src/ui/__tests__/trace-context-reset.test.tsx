import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FunctionTraceGroup } from '../components/FunctionTraceGroup';
import { completedBookingTrace } from '../fixtures/presentation';
import './test-cleanup';

describe('trace presentation context replacement', () => {
  it('clears expansion when the server-authorized context changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FunctionTraceGroup contextKey="public:session-a" traces={[completedBookingTrace]} />,
    );
    await user.click(screen.getByRole('button', { name: /Book appointment/i }));
    expect(screen.getByText('Appointment recorded')).toBeInTheDocument();

    rerender(
      <FunctionTraceGroup contextKey="patient:session-b" traces={[completedBookingTrace]} />,
    );

    expect(screen.queryByText('Appointment recorded')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Book appointment/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
