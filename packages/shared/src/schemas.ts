import { z } from 'zod';
import { isValidCpf, isValidCnpj, isValidPhone, isValidCep } from './brazil.js';
import { isValidEmail } from './email.js';
import { isValidCivilDate } from './date.js';
import { isValidMoneyCents } from './money.js';

// ---------------------------------------------------------------------------
// Primitives shared by frontend and backend validation.
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe um email.')
  .max(254, 'O email é muito longo.')
  .refine(isValidEmail, 'Informe um email válido.')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'O nome é obrigatório.')
  .max(100, 'O nome deve ter no máximo 100 caracteres.');

export const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidCpf, 'Informe um CPF válido.');

export const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidCnpj, 'Informe um CNPJ válido.');

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidPhone, 'Informe um telefone válido.');

export const cepSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidCep, 'Informe um CEP válido.');

export const documentSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => isValidCpf(v) || isValidCnpj(v), 'Informe um CPF ou CNPJ válido.');

export const uuidSchema = z.string().uuid('Identificador inválido.');

export const moneyCentsSchema = z
  .number()
  .finite('O valor deve ser um número finito.')
  .int('O valor deve ser um número inteiro em centavos.')
  .refine(isValidMoneyCents, 'O valor informado é inválido.');

export const positiveMoneyCentsSchema = z
  .number()
  .finite('O valor deve ser um número finito.')
  .int('O valor deve ser um número inteiro em centavos.')
  .positive('O valor deve ser maior que zero.')
  .max(999_999_999_999, 'O valor informado é muito alto.');

export const civilDateSchema = z
  .string()
  .refine(isValidCivilDate, 'Informe uma data válida.');

export const paginationSchema = z.object({
  page: z.coerce.number().int('A página deve ser um número inteiro.').positive('A página deve ser maior que zero.').default(1),
  limit: z.coerce.number().int('O limite deve ser um número inteiro.').positive('O limite deve ser positivo.').max(100, 'O limite máximo é 100.').default(20),
});

export const webAuthnCredentialSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string().optional(),
    authenticatorData: z.string().optional(),
    signature: z.string().optional(),
    userHandle: z.string().optional(),
  }),
  transports: z.array(z.string()).optional(),
});