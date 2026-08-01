import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExceptionInbox } from '../components/ExceptionInbox';
import { uncertainIdentityException } from '../fixtures/presentation';
import './test-cleanup';

describe('ExceptionInbox', () => {
  it('shows an owned unacknowledged exception without patient PHI', async () => {
    const user = userEvent.setup();
    const onAcknowledge = vi.fn();
    render(
      <ExceptionInbox exceptions={[uncertainIdentityException]} onAcknowledge={onAcknowledge} />,
    );

    expect(screen.getByText('requested · unacknowledged')).toBeInTheDocument();
    expect(screen.getByText(/Owner: Dr. Maya Chen/i)).toBeInTheDocument();
    expect(screen.getByText(/Due:/i)).toBeInTheDocument();
    expect(screen.getByText('Unverified demo session')).toBeInTheDocument();
    expect(screen.queryByText('Maria Lopez')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Acknowledge identity exception' }));
    expect(onAcknowledge).toHaveBeenCalledWith('exception:uncertain-identity');
  });

  it('renders an explicit empty state', () => {
    render(<ExceptionInbox exceptions={[]} onAcknowledge={vi.fn()} />);
    expect(screen.getByText('No open exceptions')).toBeInTheDocument();
  });
});
