import { describe, it, expect } from 'vitest';
import { validateAvatarFile, MAX_AVATAR_SIZE } from './avatar';

describe('validateAvatarFile', () => {
  it('accepts a valid PNG under the size limit', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1024 })).toEqual({ valid: true });
  });

  it('accepts JPEG and WebP', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: 100 }).valid).toBe(true);
    expect(validateAvatarFile({ type: 'image/webp', size: 100 }).valid).toBe(true);
  });

  it('rejects a file that is not an image', () => {
    const result = validateAvatarFile({ type: 'application/pdf', size: 100 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/imagem/);
  });

  it('rejects an unsupported image format', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 100 }).valid).toBe(false);
    expect(validateAvatarFile({ type: 'image/bmp', size: 100 }).valid).toBe(false);
  });

  it('rejects an image exceeding the size limit', () => {
    const result = validateAvatarFile({ type: 'image/png', size: MAX_AVATAR_SIZE + 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/máximo 2 MB/);
  });

  it('rejects an empty/undefined file', () => {
    expect(validateAvatarFile({ type: '', size: 0 }).valid).toBe(false);
  });
});