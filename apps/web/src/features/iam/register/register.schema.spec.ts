import { registerSchema, toRegisterRequest, type RegisterFormValues } from './register.schema';

const valid: RegisterFormValues = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'my-secure-passphrase',
  confirmPassword: 'my-secure-passphrase',
  termsAccepted: true,
};

function issuesFor(values: Partial<RegisterFormValues>) {
  const result = registerSchema.safeParse({ ...valid, ...values });
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

describe('registerSchema (client validation, mirrors TS-IAM-001)', () => {
  it('accepts valid values', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  describe('BDD 6 — every empty required field has its own error', () => {
    it('reports one specific error per field, as translation keys', () => {
      const issues = issuesFor({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
      });

      expect(issues).toEqual([
        { path: 'firstName', message: 'register.errors.firstName.required' },
        { path: 'lastName', message: 'register.errors.lastName.required' },
        { path: 'email', message: 'register.errors.email.required' },
        { path: 'password', message: 'register.errors.password.required' },
        { path: 'confirmPassword', message: 'register.errors.confirmPassword.required' },
        { path: 'termsAccepted', message: 'register.errors.terms.required' },
      ]);
    });

    it('treats whitespace-only names as empty', () => {
      expect(issuesFor({ firstName: '   ', lastName: ' \t ' })).toEqual([
        { path: 'firstName', message: 'register.errors.firstName.required' },
        { path: 'lastName', message: 'register.errors.lastName.required' },
      ]);
    });
  });

  describe('names (max 100 characters after trimming)', () => {
    it('accepts exactly 100 characters, trimmed', () => {
      expect(issuesFor({ firstName: ` ${'a'.repeat(100)} ` })).toEqual([]);
    });

    it('rejects 101 characters and counts characters, not UTF-16 units', () => {
      expect(issuesFor({ firstName: 'a'.repeat(101) })).toEqual([
        { path: 'firstName', message: 'register.errors.firstName.tooLong' },
      ]);
      expect(issuesFor({ lastName: '😀'.repeat(100) })).toEqual([]);
      expect(issuesFor({ lastName: '😀'.repeat(101) })).toEqual([
        { path: 'lastName', message: 'register.errors.lastName.tooLong' },
      ]);
    });
  });

  describe('email', () => {
    it.each(['nope', 'john@', '@example.com', 'john@example', 'a b@example.com'])(
      'rejects the malformed address %p',
      (email) => {
        expect(issuesFor({ email })).toEqual([
          { path: 'email', message: 'register.errors.email.invalid' },
        ]);
      },
    );

    it('accepts surrounding spaces and uppercase, as the server normalizes them', () => {
      expect(issuesFor({ email: '  John@Example.COM ' })).toEqual([]);
    });

    it('accepts 254 characters and rejects 255 as tooLong', () => {
      expect(issuesFor({ email: `${'a'.repeat(242)}@example.com` })).toEqual([]);
      expect(issuesFor({ email: `${'a'.repeat(243)}@example.com` })).toEqual([
        { path: 'email', message: 'register.errors.email.tooLong' },
      ]);
    });
  });

  describe('BDD 4 — password policy (8 to 128, no complexity rules)', () => {
    it('rejects 7 characters with the minimum-length message', () => {
      const short = 'a'.repeat(7);

      expect(issuesFor({ password: short, confirmPassword: short })).toEqual([
        { path: 'password', message: 'register.errors.password.tooShort' },
      ]);
    });

    it('accepts 8 and 128 characters, and rejects 129', () => {
      for (const length of [8, 128]) {
        const password = 'a'.repeat(length);
        expect(issuesFor({ password, confirmPassword: password })).toEqual([]);
      }
      const tooLong = 'a'.repeat(129);
      expect(issuesFor({ password: tooLong, confirmPassword: tooLong })).toEqual([
        { path: 'password', message: 'register.errors.password.tooLong' },
      ]);
    });

    it('imposes no complexity rules and does not trim', () => {
      expect(issuesFor({ password: '        ', confirmPassword: '        ' })).toEqual([]);
      expect(issuesFor({ password: 'alllowercase', confirmPassword: 'alllowercase' })).toEqual([]);
    });
  });

  describe('BDD 3 — password confirmation', () => {
    it('reports the mismatch on the confirmation field', () => {
      expect(issuesFor({ confirmPassword: 'another-passphrase' })).toEqual([
        { path: 'confirmPassword', message: 'register.errors.confirmPassword.mismatch' },
      ]);
    });

    it('still reports the mismatch when other fields are invalid', () => {
      expect(issuesFor({ firstName: '', confirmPassword: 'another-passphrase' })).toEqual([
        { path: 'firstName', message: 'register.errors.firstName.required' },
        { path: 'confirmPassword', message: 'register.errors.confirmPassword.mismatch' },
      ]);
    });

    it('is case sensitive', () => {
      expect(issuesFor({ confirmPassword: 'My-Secure-Passphrase' })).toHaveLength(1);
    });
  });

  describe('malformed input', () => {
    it('reports every field as required instead of throwing when values are missing', () => {
      const result = registerSchema.safeParse({});

      expect(result.success).toBe(false);
      const paths = result.error?.issues.map((issue) => issue.path.join('.'));
      expect(paths).toEqual(
        expect.arrayContaining([
          'firstName',
          'lastName',
          'email',
          'password',
          'confirmPassword',
          'termsAccepted',
        ]),
      );
    });
  });

  describe('BDD 5 — terms', () => {
    it('requires the box to be checked', () => {
      expect(issuesFor({ termsAccepted: false })).toEqual([
        { path: 'termsAccepted', message: 'register.errors.terms.required' },
      ]);
    });
  });
});

describe('toRegisterRequest', () => {
  it('trims names and email and sends the confirmation the API validates', () => {
    expect(
      toRegisterRequest({
        ...valid,
        firstName: ' John ',
        lastName: ' Doe ',
        email: '  john@example.com ',
      }),
    ).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'my-secure-passphrase',
      confirmPassword: 'my-secure-passphrase',
      termsAccepted: true,
    });
  });

  it('omits hasSeenWelcome unless the guest already saw the welcome', () => {
    expect(toRegisterRequest(valid, { hasSeenWelcome: false })).not.toHaveProperty(
      'hasSeenWelcome',
    );
    expect(toRegisterRequest(valid)).not.toHaveProperty('hasSeenWelcome');
    expect(toRegisterRequest(valid, { hasSeenWelcome: true })).toHaveProperty(
      'hasSeenWelcome',
      true,
    );
  });

  it('sends exactly the fields of the API contract', () => {
    expect(Object.keys(toRegisterRequest(valid)).sort()).toEqual(
      ['confirmPassword', 'email', 'firstName', 'lastName', 'password', 'termsAccepted'].sort(),
    );
  });
});
