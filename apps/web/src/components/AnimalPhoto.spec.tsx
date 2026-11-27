import { fireEvent, render, screen } from '@testing-library/react';

import { expectNoAxeViolations } from '../test/axe';
import { AnimalPhoto } from './AnimalPhoto';

describe('AnimalPhoto (SCRUM-56)', () => {
  it('shows the photo with its alternative text', () => {
    render(<AnimalPhoto src="https://images.example.com/luna.jpg" alt="Luna" name="Luna" />);

    expect(screen.getByRole('img', { name: 'Luna' })).toHaveAttribute(
      'src',
      'https://images.example.com/luna.jpg',
    );
  });

  it('falls back to a paw and the name when the photo cannot be loaded', () => {
    render(<AnimalPhoto src="https://images.example.com/broken.jpg" alt="Luna" name="Luna" />);

    fireEvent.error(screen.getByRole('img', { name: 'Luna' }));

    const fallback = screen.getByRole('img', { name: 'Luna' });
    expect(fallback.tagName).not.toBe('IMG');
    expect(fallback).toHaveTextContent('Luna');
  });

  it('shows the fallback when there is no photo at all', async () => {
    const { container } = render(<AnimalPhoto src="" alt="Foto 1 de Luna" name="Luna" />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Foto 1 de Luna' })).toHaveTextContent('Luna');
    await expectNoAxeViolations(container);
  });
});
