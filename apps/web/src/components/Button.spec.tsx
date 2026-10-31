import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoAxeViolations } from '../test/axe';
import { Button } from './Button';

describe('Button', () => {
  it('runs its handler when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Crear cuenta</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Mostrar</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  describe('while pending (Design System — Loading state)', () => {
    it('is marked busy and unavailable but stays focusable', async () => {
      render(
        <Button type="submit" pending>
          Creando tu cuenta…
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Creando tu cuenta…' });

      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled();
      await userEvent.tab();
      expect(button).toHaveFocus();
    });

    it('ignores clicks, including form submission', async () => {
      const onClick = vi.fn();
      const onSubmit = vi.fn((event: Event) => event.preventDefault());
      render(
        <form onSubmit={onSubmit as never}>
          <Button type="submit" pending onClick={onClick}>
            Creando tu cuenta…
          </Button>
        </form>,
      );

      await userEvent.click(screen.getByRole('button'));

      expect(onClick).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Crear cuenta</Button>);

    await expectNoAxeViolations(container);
  });
});
