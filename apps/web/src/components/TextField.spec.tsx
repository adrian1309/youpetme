import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { expectNoAxeViolations } from '../test/axe';
import { TextField } from './TextField';

describe('TextField', () => {
  it('has a visible label programmatically associated with the input', () => {
    render(<TextField label="Nombre" name="firstName" />);

    const input = screen.getByLabelText('Nombre');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute('name', 'firstName');
    expect(screen.getByText('Nombre')).toBeVisible();
  });

  it('is valid and undescribed when there is no error or hint', () => {
    render(<TextField label="Nombre" />);

    const input = screen.getByLabelText('Nombre');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('shows the error next to the field and exposes it to assistive technology', () => {
    render(<TextField label="Nombre" error="Escribe tu nombre para continuar." />);

    const input = screen.getByLabelText('Nombre');
    const error = screen.getByText('Escribe tu nombre para continuar.');
    expect(error).toBeVisible();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Escribe tu nombre para continuar.');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('describes the field with both the hint and the error', () => {
    render(
      <TextField
        label="Correo"
        hint="Usaremos este correo para iniciar sesión."
        error="Escribe un correo válido."
      />,
    );

    expect(screen.getByLabelText('Correo')).toHaveAccessibleDescription(
      'Usaremos este correo para iniciar sesión. Escribe un correo válido.',
    );
  });

  it('marks the field as required for assistive technology', () => {
    render(<TextField label="Nombre" required />);

    expect(screen.getByLabelText('Nombre')).toBeRequired();
  });

  it('forwards input attributes and the ref', async () => {
    const ref = createRef<HTMLInputElement>();
    const onBlur = vi.fn();
    render(
      <TextField
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        onBlur={onBlur}
        ref={ref}
      />,
    );

    const input = screen.getByLabelText('Correo electrónico');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(ref.current).toBe(input);
    await userEvent.click(input);
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('gives each field its own ids', () => {
    render(
      <>
        <TextField label="Nombre" error="a" />
        <TextField label="Apellidos" error="b" />
      </>,
    );

    expect(screen.getByLabelText('Nombre').id).not.toBe(screen.getByLabelText('Apellidos').id);
  });

  it('has no accessibility violations, with or without an error', async () => {
    const { container } = render(
      <>
        <TextField label="Nombre" />
        <TextField
          label="Apellidos"
          error="Escribe tus apellidos para continuar."
          hint="Como en tu DNI"
        />
      </>,
    );

    await expectNoAxeViolations(container);
  });
});
