import es from './locales/es.json';
import { i18n } from './index';

function flatten(node: unknown, prefix = ''): Array<[string, unknown]> {
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([key, value]) =>
      flatten(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [[prefix, node]];
}

describe('i18n (NFR: translation keys, Spanish first)', () => {
  it('defaults to Spanish and the document language matches', () => {
    expect(i18n.language).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('resolves the registration keys with the approved copy', () => {
    expect(i18n.t('register.title')).toBe('Crea tu cuenta');
    expect(i18n.t('register.fields.firstName.label')).toBe('Nombre');
    expect(i18n.t('register.fields.lastName.label')).toBe('Apellidos');
    expect(i18n.t('register.fields.email.label')).toBe('Correo electrónico');
    expect(i18n.t('register.fields.password.label')).toBe('Contraseña');
    expect(i18n.t('register.fields.confirmPassword.label')).toBe('Confirmar contraseña');
    expect(i18n.t('register.actions.submit')).toBe('Crear cuenta');
    expect(i18n.t('register.actions.submitting')).toBe('Creando tu cuenta…');
    expect(i18n.t('register.login.prompt')).toBe('¿Ya tienes una cuenta?');
  });

  it('has distinct show/hide copy for the password and its confirmation', () => {
    expect(i18n.t('register.fields.password.show')).toBe('Mostrar contraseña');
    expect(i18n.t('register.fields.password.hide')).toBe('Ocultar contraseña');
    expect(i18n.t('register.fields.confirmPassword.show')).toBe(
      'Mostrar confirmación de contraseña',
    );
    expect(i18n.t('register.fields.confirmPassword.hide')).toBe(
      'Ocultar confirmación de contraseña',
    );
  });

  it('has the not-found copy', () => {
    expect(i18n.t('notFound.title')).toBe('Página no encontrada');
    expect(i18n.t('notFound.body')).toBe(
      'No hemos encontrado la página que buscas. Revisa la dirección o vuelve al inicio.',
    );
  });

  it('interpolates limits and names instead of hard-coding them', () => {
    expect(i18n.t('register.errors.password.tooShort', { min: 8 })).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    expect(i18n.t('register.errors.password.tooLong', { max: 128 })).toBe(
      'La contraseña debe tener 128 caracteres como máximo.',
    );
    expect(i18n.t('register.errors.firstName.tooLong', { nameMax: 100 })).toBe(
      'El nombre debe tener 100 caracteres como máximo.',
    );
    expect(i18n.t('register.errors.email.tooLong', { emailMax: 254 })).toBe(
      'El correo debe tener 254 caracteres como máximo.',
    );
    expect(i18n.t('home.greeting', { name: 'John' })).toBe('Hola, John');
  });

  it('has the server and network messages, none of them leaking technical detail', () => {
    const keys = ['emailInUse', 'requestRejected', 'server', 'network', 'reviewFields', 'generic'];
    for (const key of keys) {
      const text = i18n.t(`register.errors.${key}`);
      expect(text).not.toBe(`register.errors.${key}`);
      expect(text).not.toMatch(/\b(40[0-9]|415|500|status|error code|exception)\b/i);
    }
    expect(i18n.t('register.errors.emailInUse')).toBe(
      'Este correo ya está en uso. Inicia sesión o prueba con otro correo.',
    );
  });

  it('has no empty copy', () => {
    for (const [key, value] of flatten(es)) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim().length, key).toBeGreaterThan(0);
    }
  });
});
