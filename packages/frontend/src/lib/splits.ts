import { splitAmountCents } from '@oxedindin/shared';

/**
 * Computes each person's share when a total (in integer cents) is divided
 * equally among `personCount` people AND the current user. The user keeps the
 * last share; the returned array holds the first `personCount` shares so the
 * people's shares always sum with the user's share to the full total.
 */
export function equalSplitShares(totalCents: number, personCount: number): number[] {
  if (personCount <= 0) return [];
  return splitAmountCents(totalCents, personCount + 1).slice(0, personCount);
}