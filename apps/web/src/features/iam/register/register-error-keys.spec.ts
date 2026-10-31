import { i18n } from '../../../lib/i18n';
import { FIELD_ERROR_KEYS, REGISTER_FORM_ERROR_KEYS } from './map-register-error';
import { registerSchema } from './register.schema';

describe('registration error keys exist in es.json', () => {
  it('has copy for every key the API error mapping can produce', () => {
    const keys = [
      ...Object.values(FIELD_ERROR_KEYS).flatMap((codes) => Object.values(codes)),
      ...Object.values(REGISTER_FORM_ERROR_KEYS),
    ];

    for (const key of keys) {
      expect(i18n.exists(key), key).toBe(true);
    }
  });

  it('has copy for every key the client schema can produce', () => {
    const invalidInputs = [
      {},
      {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
      },
      {
        firstName: 'a'.repeat(101),
        lastName: 'a'.repeat(101),
        email: `${'a'.repeat(243)}@example.com`,
        password: 'a'.repeat(129),
        confirmPassword: 'different',
        termsAccepted: false,
      },
      {
        firstName: 'a',
        lastName: 'b',
        email: 'nope',
        password: 'short',
        confirmPassword: 'short',
        termsAccepted: true,
      },
    ];

    const messages = invalidInputs.flatMap((input) => {
      const result = registerSchema.safeParse(input);
      return result.success ? [] : result.error.issues.map((issue) => issue.message);
    });

    expect(messages.length).toBeGreaterThan(10);
    for (const key of new Set(messages)) {
      expect(i18n.exists(key), key).toBe(true);
    }
  });
});
