import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service.js';

// The AuthService constructor receives a Fastify instance; these tests only
// exercise methods that do not touch the database or HTTP layer.
const app = {} as any;
const service = new AuthService(app);

describe('AuthService.generateSecurePassword', () => {
  it('generates a password with the default length of 16', async () => {
    const password = await service.generateSecurePassword();
    expect(password).toHaveLength(16);
  });

  it('generates a password with a custom length', async () => {
    const password = await service.generateSecurePassword({ length: 24 });
    expect(password).toHaveLength(24);
  });

  it('respects character type options', async () => {
    for (let i = 0; i < 20; i++) {
      const password = await service.generateSecurePassword({ uppercase: false, lowercase: false, numbers: true, symbols: false });
      expect(password).toMatch(/^[0-9]+$/);
      expect(password).toHaveLength(16);
    }
  });

  it('throws when no character type is selected', async () => {
    await expect(service.generateSecurePassword({ uppercase: false, lowercase: false, numbers: false, symbols: false }))
      .rejects.toThrow('At least one character type must be selected');
  });

  it('generates unique passwords across calls', async () => {
    const [a, b, c] = await Promise.all([
      service.generateSecurePassword(),
      service.generateSecurePassword(),
      service.generateSecurePassword(),
    ]);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('guarantees at least one char of each selected type', async () => {
    for (let i = 0; i < 20; i++) {
      const password = await service.generateSecurePassword({ length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true });
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/);
    }
  });
});

describe('AuthService password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await service.hashPassword('s3cret-pass!');
    expect(hash).toBeTruthy();
    expect(hash).not.toContain('s3cret-pass!');

    const ok = await service.verifyPassword('s3cret-pass!', hash);
    expect(ok).toBe(true);

    const wrong = await service.verifyPassword('wrong-pass!', hash);
    expect(wrong).toBe(false);
  });

  it('generates unique hashes for the same password', async () => {
    const [a, b] = await Promise.all([
      service.hashPassword('same-password'),
      service.hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });
});

describe('AuthService token hashing', () => {
  it('hashes and verifies a token hash', async () => {
    const token = crypto.randomUUID();
    const tokenHash = await service.hashToken(token);
    const ok = await service.verifyTokenHash(token, tokenHash);
    expect(ok).toBe(true);

    const wrong = await service.verifyTokenHash('other-token', tokenHash);
    expect(wrong).toBe(false);
  });
});