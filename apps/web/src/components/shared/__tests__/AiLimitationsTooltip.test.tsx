// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiLimitationsTooltip } from '../AiLimitationsTooltip';

describe('AiLimitationsTooltip', () => {
  it('renders the trigger button', () => {
    render(<AiLimitationsTooltip />);
    expect(screen.getByText('AI Limitations')).toBeInTheDocument();
  });

  it('shows tooltip content on click', async () => {
    const user = userEvent.setup();
    render(<AiLimitationsTooltip />);

    await user.click(screen.getByText('AI Limitations'));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Known AI Limitations')).toBeInTheDocument();
    expect(screen.getByText(/Hand & finger quality/)).toBeInTheDocument();
    expect(screen.getByText(/Fabric clipping/)).toBeInTheDocument();
    expect(screen.getByText(/Text & logos/)).toBeInTheDocument();
    expect(screen.getByText(/Symmetry/)).toBeInTheDocument();
    expect(screen.getByText(/Background consistency/)).toBeInTheDocument();
  });

  it('toggles tooltip on click', async () => {
    const user = userEvent.setup();
    render(<AiLimitationsTooltip />);

    await user.click(screen.getByText('AI Limitations'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.click(screen.getByText('AI Limitations'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('has proper aria attributes', () => {
    render(<AiLimitationsTooltip />);
    const button = screen.getByLabelText('AI limitations info');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
