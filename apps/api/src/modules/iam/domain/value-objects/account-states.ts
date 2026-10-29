/** MVP roles only (Domain Model — Roles); other roles are added with their functionality. */
export type Role = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
