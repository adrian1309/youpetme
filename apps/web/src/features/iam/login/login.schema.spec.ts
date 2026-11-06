import { loginSchema, toLoginRequest, type LoginFormValues } from './login.schema';

const valid: LoginFormValues = { email: 'john@example.com', password: 'any-password' };

function issuesFor(values: Partial<LoginFormValues>) {
  const result = loginSchema.safeParse({ ...valid, ...values });
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

describe('loginSchema (client validation, mirrors TS-IAM-002)', () => {
  it('accepts valid values', () => {
    expect(issuesFor({})).toEqual([]);
  });

  it('requires both fields, with translation keys as messages', () => {
    expect(issuesFor({ email: '', password: '' })).toEqual([
      { path: 'email', message: 'login.errors.email.required' },
      { path: 'password', message: 'login.errors.password.required' },
    ]);
  });

  it('checks the email format and length like the API', () => {
    expect(issuesFor({ email: 'not-an-email' })).toEqual([
      { path: 'email', message: 'login.errors.email.invalid' },
    ]);
    expect(issuesFor({ email: `${'a'.repeat(250)}@x.es` })).toEqual([
      { path: 'email', message: 'login.errors.email.tooLong' },
    ]);
    expect(issuesFor({ email: '  John@Example.com ' })).toEqual([]);
  });

  it('does not apply the password policy: any non-empty password is checked by the server', () => {
    expect(issuesFor({ password: 'short' })).toEqual([]);
    expect(issuesFor({ password: ' ' })).toEqual([]);
  });

  it('sends the email trimmed and the password untouched', () => {
    expect(toLoginRequest({ email: '  john@example.com ', password: ' pass ' })).toEqual({
      email: 'john@example.com',
      password: ' pass ',
    });
  });
});
