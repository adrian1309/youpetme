import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoAxeViolations } from '../test/axe';
import { PasswordField } from './PasswordField';

const labels = { showLabel: 'Mostrar contraseña', hideLabel: 'Ocultar contraseña' };

describe('PasswordField', () => {
  it('hides the value by default', () => {
    render(<PasswordField label="Contraseña" {...labels} />);

    expect(screen.getByLabelText('Contraseña', { selector: 'input' })).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('has a show/hide toggle whose name says what it will do', async () => {
    render(<PasswordField label="Contraseña" {...labels} />);
    const input = screen.getByLabelText('Contraseña', { selector: 'input' });

    const show = screen.getByRole('button', { name: 'Mostrar contraseña' });
    await userEvent.click(show);

    expect(input).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', { name: 'Ocultar contraseña' });
    await userEvent.click(hide);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('is operable from the keyboard and keeps the focus on the toggle', async () => {
    render(<PasswordField label="Contraseña" {...labels} />);
    const input = screen.getByLabelText('Contraseña', { selector: 'input' });

    await userEvent.click(input);
    await userEvent.tab();
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(toggle).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('never submits the form when toggling', async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit as never}>
        <PasswordField label="Contraseña" {...labels} />
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows pasting, so password managers keep working', async () => {
    render(<PasswordField label="Contraseña" {...labels} />);
    const input = screen.getByLabelText('Contraseña', { selector: 'input' });

    await userEvent.click(input);
    await userEvent.paste('pasted-passphrase');

    expect(input).toHaveValue('pasted-passphrase');
  });

  it('shows the requirement near the field with a text status, not only colour', () => {
    const { rerender } = render(
      <PasswordField
        label="Contraseña"
        {...labels}
        hint="Al menos 8 caracteres — pendiente"
        hintState="pending"
      />,
    );
    const input = screen.getByLabelText('Contraseña', { selector: 'input' });
    expect(input).toHaveAccessibleDescription('Al menos 8 caracteres — pendiente');

    rerender(
      <PasswordField
        label="Contraseña"
        {...labels}
        hint="Al menos 8 caracteres — cumplido"
        hintState="met"
      />,
    );
    expect(input).toHaveAccessibleDescription('Al menos 8 caracteres — cumplido');
  });

  it('shows the error and keeps new-password autocomplete', () => {
    render(
      <PasswordField
        label="Contraseña"
        {...labels}
        autoComplete="new-password"
        error="La contraseña debe tener al menos 8 caracteres."
      />,
    );

    const input = screen.getByLabelText('Contraseña', { selector: 'input' });
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('La contraseña debe tener al menos 8 caracteres.');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PasswordField
        label="Contraseña"
        {...labels}
        hint="Al menos 8 caracteres — pendiente"
        hintState="pending"
      />,
    );

    await expectNoAxeViolations(container);
  });
});
