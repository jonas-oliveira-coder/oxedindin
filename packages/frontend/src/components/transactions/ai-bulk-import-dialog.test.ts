import { describe, it, expect } from 'vitest';
import { cleanJsonInput, AI_IMPORT_SYSTEM_PROMPT, getAiImportPrompt } from './ai-bulk-import-dialog';

describe('AI Bulk Import Utilities', () => {
  it('cleans raw JSON without code blocks', () => {
    const raw = '{"bankAccounts": []}';
    expect(cleanJsonInput(raw)).toBe('{"bankAccounts": []}');
  });

  it('strips markdown ```json fences', () => {
    const raw = '```json\n{"bankAccounts": []}\n```';
    expect(cleanJsonInput(raw)).toBe('{"bankAccounts": []}');
  });

  it('strips markdown ``` fences without language specifier', () => {
    const raw = '```\n{"categories": [{"name": "Alimentação"}]}\n```';
    expect(cleanJsonInput(raw)).toBe('{"categories": [{"name": "Alimentação"}]}');
  });

  it('parses cleaned JSON successfully', () => {
    const raw = '```json\n{\n  "transactions": [\n    {"description": "Mercado", "amount": 100.50}\n  ]\n}\n```';
    const cleaned = cleanJsonInput(raw);
    const parsed = JSON.parse(cleaned);
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0].description).toBe('Mercado');
    expect(parsed.transactions[0].amount).toBe(100.50);
  });

  it('includes required instructions and structure in the AI prompt', () => {
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('OxeDinDin');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('bankAccounts');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('creditCards');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('categories');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('transactions');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('bills');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('debts');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('JSON válido');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('NÃO GERAR PARCELAS RETROATIVAS');
    expect(AI_IMPORT_SYSTEM_PROMPT).toContain('DATA DE REFERÊNCIA DE HOJE');
  });

  it('generates prompt with custom reference date', () => {
    const prompt = getAiImportPrompt('2026-12-25');
    expect(prompt).toContain('DATA DE REFERÊNCIA DE HOJE: 2026-12-25');
    expect(prompt).toContain('NÃO GERAR PARCELAS RETROATIVAS');
  });
});
