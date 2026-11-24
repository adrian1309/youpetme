import { render, screen } from '@testing-library/react';

import { expectNoAxeViolations } from '../test/axe';
import { Notice } from './Notice';

describe('Notice', () => {
  it('is announced politely as a status message', () => {
    render(<Notice>Tu contraseña se ha actualizado.</Notice>);

    expect(screen.getByRole('status')).toHaveTextContent('Tu contraseña se ha actualizado.');
  });

  it('moves the focus to itself when asked, so the message is read out', () => {
    render(<Notice focusOnMount>Hecho.</Notice>);

    expect(screen.getByRole('status')).toHaveFocus();
  });

  it('does not steal the focus by default', () => {
    render(<Notice>Hecho.</Notice>);

    expect(screen.getByRole('status')).not.toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Notice>Hecho.</Notice>);

    await expectNoAxeViolations(container);
  });
});
