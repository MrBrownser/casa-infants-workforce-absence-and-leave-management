import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound from './not-found';

describe('root not-found page', () => {
  it('renders the Catalan copy', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'No hem trobat aquesta pàgina' })).toBeTruthy();
    expect(screen.getByText("Potser l'adreça no és correcta o la pàgina ja no existeix.")).toBeTruthy();
  });

  it('shows the status line with an icon and text', () => {
    render(<NotFound />);
    const status = screen.getByText('Error 404');
    expect(status.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('links back to the dashboard', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: "Torna a l'inici" });
    expect(link.getAttribute('href')).toBe('/dashboard');
  });

  it('contains no English text', () => {
    const { container } = render(<NotFound />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('This page could not be found');
    expect(text).not.toContain('404 |');
  });
});
