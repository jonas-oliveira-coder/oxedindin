export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface AvatarValidation {
  valid: boolean;
  error?: string;
}

/**
 * Client-side validation for avatar uploads. The backend validates again
 * (MIME, size, dimensions via sharp) — this only improves UX.
 */
export function validateAvatarFile(file: { type: string; size: number }): AvatarValidation {
  if (!file || !file.type) {
    return { valid: false, error: 'Envie um arquivo de imagem.' };
  }
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'O arquivo deve ser uma imagem.' };
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return { valid: false, error: 'Formato inválido. Use JPG, PNG ou WebP.' };
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return { valid: false, error: 'Imagem muito grande (máximo 2 MB).' };
  }
  return { valid: true };
}