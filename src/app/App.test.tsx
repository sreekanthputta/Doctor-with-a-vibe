import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { resolveShell } from './routes';

describe('route shells', () => {
  it.each([
    ['/', 'public'],
    ['/demo', 'demo'],
    ['/patient/visit', 'patient'],
    ['/physician/inbox', 'physician'],
  ] as const)('maps %s to the %s trust-domain shell', (path, expected) => {
    expect(resolveShell(path)).toBe(expected);
  });

  it('always labels the experience as synthetic', () => {
    render(<App />);
    expect(screen.getByText(/synthetic data/i)).toBeInTheDocument();
    expect(screen.getByText(/Powered by Medplum/i)).toBeInTheDocument();
  });
});
