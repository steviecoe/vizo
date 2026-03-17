// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TenantSettings } from '../TenantSettings';

vi.mock('@/lib/firebase/functions', () => ({
  callFunction: vi.fn(),
}));

vi.mock('@vizo/shared', () => ({
  SUPPORTED_LOCALES: ['en', 'pl', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'],
  LOCALE_LABELS: {
    en: 'English',
    pl: 'Polski',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    it: 'Italiano',
    pt: 'Português',
    nl: 'Nederlands',
    ja: '日本語',
    ko: '한국어',
    zh: '中文',
  },
}));

import { callFunction } from '@/lib/firebase/functions';

const mockCallFunction = callFunction as ReturnType<typeof vi.fn>;

describe('TenantSettings', () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it('renders loading skeleton initially', () => {
    mockCallFunction.mockReturnValue(new Promise(() => {}));
    render(<TenantSettings />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders settings form after loading', async () => {
    mockCallFunction.mockResolvedValue({
      language: { defaultLocale: 'en', autoDetect: true },
    });

    render(<TenantSettings />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Save Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Default Language')).toBeInTheDocument();
  });

  it('displays loaded locale in select', async () => {
    mockCallFunction.mockResolvedValue({
      language: { defaultLocale: 'de', autoDetect: false },
    });

    render(<TenantSettings />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Default Language') as HTMLSelectElement;
    expect(select.value).toBe('de');
  });

  it('calls updateTenantLanguage on save', async () => {
    mockCallFunction
      .mockResolvedValueOnce({
        language: { defaultLocale: 'en', autoDetect: true },
      })
      .mockResolvedValueOnce({ success: true });

    render(<TenantSettings />);

    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully.')).toBeInTheDocument();
    });

    expect(mockCallFunction).toHaveBeenCalledWith('updateTenantLanguage', {
      defaultLocale: 'en',
      autoDetect: true,
    });
  });

  it('renders error state on load failure', async () => {
    mockCallFunction.mockRejectedValue({ message: 'Network error' });

    render(<TenantSettings />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('renders error state on save failure', async () => {
    mockCallFunction
      .mockResolvedValueOnce({
        language: { defaultLocale: 'en', autoDetect: true },
      })
      .mockRejectedValueOnce({ message: 'Unsupported locale' });

    render(<TenantSettings />);

    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unsupported locale');
    });
  });

  it('toggles auto-detect checkbox', async () => {
    mockCallFunction.mockResolvedValue({
      language: { defaultLocale: 'en', autoDetect: true },
    });

    render(<TenantSettings />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });
});
