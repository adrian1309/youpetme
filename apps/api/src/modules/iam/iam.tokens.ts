/** Dependency-injection tokens for the IAM ports (interfaces have no runtime identity). */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const ACCOUNT_REGISTRATION_REPOSITORY = Symbol('ACCOUNT_REGISTRATION_REPOSITORY');
export const REGISTER_USER_USE_CASE = Symbol('REGISTER_USER_USE_CASE');
export const USER_SESSION_REPOSITORY = Symbol('USER_SESSION_REPOSITORY');
export const LOGIN_USER_USE_CASE = Symbol('LOGIN_USER_USE_CASE');
export const REFRESH_SESSION_USE_CASE = Symbol('REFRESH_SESSION_USE_CASE');
export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');
export const REVOKE_SESSION_USE_CASE = Symbol('REVOKE_SESSION_USE_CASE');
