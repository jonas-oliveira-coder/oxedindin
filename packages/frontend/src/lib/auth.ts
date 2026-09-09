interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const TOKEN_KEY = 'oxedindin_tokens';

export function getAuthTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const tokens = JSON.parse(stored) as AuthTokens;
    if (tokens.expiresAt < Date.now()) {
      clearAuthTokens();
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}

export function setAuthTokens(tokens: { accessToken: string; refreshToken: string; expiresIn: number }): void {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + tokens.expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...tokens, expiresAt }));
}

export function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAuthTokens() !== null;
}