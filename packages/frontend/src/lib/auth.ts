// Authentication tokens are now transported exclusively via httpOnly cookies
// (set by the backend), so the frontend never stores access/refresh tokens.
// Only the CSRF token is kept in memory: it is not sensitive and is required
// as a custom header on mutating requests to satisfy @fastify/csrf-protection.

let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string): void {
  csrfToken = token;
}