import { describe, it, expect } from 'vitest';
import {
  money,
  moneyFromReais,
  moneyToReais,
  addMoney,
  subtractMoney,
  multiplyMoney,
  formatMoney,
} from './index.js';

describe('money helpers', () => {
  it('creates a money value from cents', () => {
    expect(money(12345)).toEqual({ cents: 12345, currency: 'BRL' });
  });

  it('creates a money value from reais', () => {
    expect(moneyFromReais(123.45)).toEqual({ cents: 12345, currency: 'BRL' });
    expect(moneyFromReais(0.1)).toEqual({ cents: 10, currency: 'BRL' });
  });

  it('converts money back to reais', () => {
    expect(moneyToReais(money(12345))).toBe(123.45);
  });

  it('adds and subtracts money', () => {
    expect(addMoney(money(1000), money(250))).toEqual(money(1250));
    expect(subtractMoney(money(1000), money(250))).toEqual(money(750));
  });

  it('multiplies money', () => {
    expect(multiplyMoney(money(1000), 1.5)).toEqual(money(1500));
    expect(multiplyMoney(money(33), 3)).toEqual(money(99));
  });

  it('formats money as BRL in pt-BR', () => {
    const formatted = formatMoney(money(12345));
    expect(formatted).toContain('123,45');
  });
});