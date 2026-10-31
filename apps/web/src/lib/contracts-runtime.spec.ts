import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type ErrorResponse,
  type RegisterRequest,
} from '@youpetme/contracts';

describe('@youpetme/contracts at runtime in the web app', () => {
  it('exposes the validation constants the client mirrors from the API', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(NAME_MAX_LENGTH).toBe(100);
  });

  it('exposes the transport types', () => {
    const request: RegisterRequest = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'my-secure-passphrase',
      confirmPassword: 'my-secure-passphrase',
      termsAccepted: true,
    };
    const error: ErrorResponse = { statusCode: 409, error: 'Conflict', message: 'x' };

    expect(request.termsAccepted).toBe(true);
    expect(error.statusCode).toBe(409);
  });
});
