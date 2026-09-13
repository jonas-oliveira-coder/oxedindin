/**
 * Splits a total amount (in integer cents) into `count` installments of equal
 * value, distributing the remainder (the cents that do not divide evenly) over
 * the first installments, so each installment differs by at most one cent.
 */
export function splitAmountCents(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error('totalCents must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }

  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(base + (i < remainder ? 1 : 0));
  }
  return values;
}