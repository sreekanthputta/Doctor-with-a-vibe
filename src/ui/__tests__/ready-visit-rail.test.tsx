import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadyVisitRail } from '../components/ReadyVisitRail';
import { needsAttentionVisit, readyVisit } from '../fixtures/presentation';
import './test-cleanup';

describe('ReadyVisitRail', () => {
  it('never presents an open required task as Ready', () => {
    render(<ReadyVisitRail visit={needsAttentionVisit} />);

    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.queryByText('Ready', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText(/Insurance member ID required/i)).toBeInTheDocument();
  });

  it('announces a valid transition to Ready without relying on color', () => {
    const { rerender } = render(<ReadyVisitRail visit={needsAttentionVisit} />);
    rerender(<ReadyVisitRail visit={readyVisit} />);

    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    expect(screen.getByLabelText('Ready visit')).toBeInTheDocument();
    expect(screen.getByText('Coverage response received')).toBeInTheDocument();
  });
});
