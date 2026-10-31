import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { expectNoAxeViolations } from '../test/axe';
import { CheckboxField } from './CheckboxField';

const label = (
  <>
    Acepto los <a href="/terms">Términos de Servicio</a> y la{' '}
    <a href="/privacy">Política de Privacidad</a>.
  </>
);

describe('CheckboxField', () => {
  it('is a native checkbox labelled by its text, including the links', () => {
    render(<CheckboxField name="termsAccepted" label={label} />);

    const checkbox = screen.getByRole('checkbox', {
      name: /Acepto los Términos de Servicio y la Política de Privacidad/,
    });
    expect(checkbox).toHaveAttribute('name', 'termsAccepted');
    expect(checkbox).not.toBeChecked();
  });

  it('toggles with the mouse', async () => {
    render(<CheckboxField label={label} />);
    const checkbox = screen.getByRole('checkbox');

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('toggles with the space bar once focused from the keyboard', async () => {
    render(<CheckboxField label={label} />);
    const checkbox = screen.getByRole('checkbox');

    await userEvent.tab();
    expect(checkbox).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(checkbox).toBeChecked();
    await userEvent.keyboard(' ');
    expect(checkbox).not.toBeChecked();
  });

  it('keeps the links reachable by keyboard after the checkbox', async () => {
    render(<CheckboxField label={label} />);

    await userEvent.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Términos de Servicio' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Política de Privacidad' })).toHaveFocus();
  });

  it('clicking a link does not toggle the checkbox', async () => {
    render(<CheckboxField label={label} />);
    const link = screen.getByRole('link', { name: 'Términos de Servicio' });
    link.addEventListener('click', (event) => event.preventDefault());

    await userEvent.click(link);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows the error and ties it to the checkbox', () => {
    render(
      <CheckboxField
        label={label}
        error="Para crear la cuenta, acepta los Términos de Servicio y la Política de Privacidad."
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox).toHaveAccessibleDescription(
      'Para crear la cuenta, acepta los Términos de Servicio y la Política de Privacidad.',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <>
        <CheckboxField label={label} />
        <CheckboxField label={label} error="Obligatorio" />
      </>,
    );

    await expectNoAxeViolations(container);
  });
});
