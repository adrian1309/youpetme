import { screen, waitFor, within } from '@testing-library/react';

import { expectNoAxeViolations } from '../../../test/axe';
import {
  jsonResponse,
  renderWithProviders,
  TEST_API_URL,
} from '../../../test/render-with-providers';
import { i18n } from '../../../lib/i18n';
import { PrivacyPage } from './PrivacyPage';
import { PRIVACY_SECTIONS } from './privacy-sections';
import { TERMS_SECTIONS } from './terms-sections';
import { TermsPage } from './TermsPage';

const VERSION_URL = `${TEST_API_URL}/api/v1/legal/terms-version`;
const PENDING = /\[Pendiente de definir\]/;

function versionFetch(version = '2026-01') {
  return vi.fn().mockResolvedValue(jsonResponse(200, { version }));
}

const pages = [
  {
    name: 'TermsPage',
    Page: TermsPage,
    title: 'Términos de Servicio',
    sections: [
      'Qué es YouPetMe',
      'Estado del servicio',
      'Tu cuenta',
      'Tu sesión',
      'Aceptación y versiones',
      'Funcionalidades aún no disponibles',
      'Aspectos pendientes de definir',
    ],
  },
  {
    name: 'PrivacyPage',
    Page: PrivacyPage,
    title: 'Política de Privacidad',
    sections: [
      'Responsable del tratamiento',
      'Datos que tratamos al crear tu cuenta',
      'Datos de sesión',
      'Datos guardados en tu navegador',
      'Para qué usamos tus datos',
      'Base jurídica',
      'Solo los datos necesarios',
      'Cuánto tiempo conservamos tus datos',
      'Quién más puede acceder a tus datos',
      'Tus derechos',
      'Cómo protegemos tus datos',
      'Cambios en esta política',
    ],
  },
] as const;

describe.each(pages)('$name', ({ Page, title, sections }) => {
  it('has its title as the only h1 and as the document title', async () => {
    renderWithProviders(<Page />, { fetch: versionFetch() });

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await waitFor(() => expect(document.title).toBe(`${title} · YouPetMe`));
  });

  it('warns visibly that the text is a provisional academic draft, not legal advice', () => {
    renderWithProviders(<Page />, { fetch: versionFetch() });

    const notice = screen.getByRole('note', { name: 'Borrador provisional' });
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent(/carácter académico/);
    expect(notice).toHaveTextContent(/no constituye asesoramiento jurídico/);
  });

  it('lists its sections as h2 headings, in order', () => {
    renderWithProviders(<Page />, { fetch: versionFetch() });

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(sections);
  });

  it('marks what the documentation has not decided yet instead of inventing it', () => {
    renderWithProviders(<Page />, { fetch: versionFetch() });

    expect(screen.getAllByText(PENDING).length).toBeGreaterThan(0);
  });

  it('shows the version the server records on registration', async () => {
    const fetchMock = versionFetch('2026-01');
    renderWithProviders(<Page />, { fetch: fetchMock });

    expect(screen.getByText('Cargando la versión vigente…')).toBeInTheDocument();
    expect(await screen.findByText('Versión vigente: 2026-01')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(VERSION_URL);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'GET' });
  });

  it('keeps the text readable and says so when the version cannot be loaded', async () => {
    renderWithProviders(<Page />, {
      fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    expect(
      await screen.findByText(
        'No hemos podido cargar la versión vigente. Vuelve a intentarlo más tarde.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: sections[0] })).toBeVisible();
  });

  it('offers a way back to the home', () => {
    renderWithProviders(<Page />, { fetch: versionFetch() });

    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });

  it('has no accessibility violations once the version is loaded', async () => {
    const { container } = renderWithProviders(<Page />, { fetch: versionFetch() });
    await screen.findByText(/Versión vigente:/);

    await expectNoAxeViolations(container);
  });

  it('has no accessibility violations when the version cannot be loaded', async () => {
    const { container } = renderWithProviders(<Page />, {
      fetch: vi.fn().mockResolvedValue(jsonResponse(500, { message: 'x' })),
    });
    await screen.findByText(/No hemos podido cargar la versión vigente/);

    await expectNoAxeViolations(container);
  });
});

describe('translation keys', () => {
  it.each([
    ['TERMS_SECTIONS', TERMS_SECTIONS],
    ['PRIVACY_SECTIONS', PRIVACY_SECTIONS],
  ])('every key in %s exists in the Spanish locale', (_, sections) => {
    const keys = sections.flatMap((section) => [
      section.title,
      ...section.blocks.flatMap((block) => ('paragraph' in block ? [block.paragraph] : block.list)),
    ]);

    expect(keys.filter((key) => !i18n.exists(key))).toEqual([]);
  });
});

describe('PrivacyPage content', () => {
  it('names the data collected at registration, as documented in TS-IAM-001', () => {
    renderWithProviders(<PrivacyPage />, { fetch: versionFetch() });

    const section = screen
      .getByRole('heading', { level: 2, name: 'Datos que tratamos al crear tu cuenta' })
      .closest('section')!;
    for (const item of [/Nombre y apellidos/, /Correo electrónico/, /Contraseña/, /versión/]) {
      expect(within(section).getByText(item)).toBeInTheDocument();
    }
    expect(section).toHaveTextContent(/nunca se guarda en claro/);
  });

  it('names what is kept in the browser: the session cookie and the Diango welcome mark', () => {
    renderWithProviders(<PrivacyPage />, { fetch: versionFetch() });

    const section = screen
      .getByRole('heading', { level: 2, name: 'Datos guardados en tu navegador' })
      .closest('section')!;
    expect(section).toHaveTextContent(/HttpOnly/);
    expect(section).toHaveTextContent('youpetme:diango-welcome-seen');
  });
});
