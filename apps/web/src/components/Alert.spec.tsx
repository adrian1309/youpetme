import { render, screen } from '@testing-library/react';

import { expectNoAxeViolations } from '../test/axe';
import { Alert } from './Alert';

describe('Alert', () => {
  it('is announced to screen readers as an alert', () => {
    render(<Alert>No hemos podido conectar con el servidor.</Alert>);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No hemos podido conectar con el servidor.',
    );
  });

  it('moves the focus to itself when asked, so the message is read out', () => {
    render(<Alert focusOnMount>Algo ha fallado por nuestra parte.</Alert>);

    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('does not steal the focus by default', () => {
    render(<Alert>Aviso</Alert>);

    expect(screen.getByRole('alert')).not.toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Alert>Aviso</Alert>);

    await expectNoAxeViolations(container);
  });
});
