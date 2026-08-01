import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SyntheticDemoAccessShell } from '../shells/demo-access/SyntheticDemoAccessShell';
import './test-cleanup';

describe('SyntheticDemoAccessShell', () => {
  it('labels persona selection as a synthetic demo rather than authentication', async () => {
    const user = userEvent.setup();
    const onSelectPersona = vi.fn();
    render(<SyntheticDemoAccessShell state="ready" onSelectPersona={onSelectPersona} />);

    expect(screen.getByText('Synthetic Demo Access')).toBeInTheDocument();
    expect(screen.getByText(/persona selector, not authentication/i)).toBeInTheDocument();
    expect(screen.queryByText(/log in/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue as Maria Lopez/i }));
    expect(onSelectPersona).toHaveBeenCalledWith('maria-demo');
  });

  it('offers only allowlisted fictional personas', () => {
    render(<SyntheticDemoAccessShell state="ready" onSelectPersona={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /Continue as/i })).toHaveLength(2);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
