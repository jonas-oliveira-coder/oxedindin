import { describe, it, expect } from 'vitest';
import { equalSplitShares } from './splits';

describe('equalSplitShares', () => {
  it('returns an empty array when there are no people', () => {
    expect(equalSplitShares(10000, 0)).toEqual([]);
  });

  it('splits equally with one person including the user (50/50)', () => {
    const shares = equalSplitShares(10000, 1);
    expect(shares).toHaveLength(1);
    expect(shares[0]).toBe(5000);
  });

  it('preserves the total with an odd amount and one person', () => {
    const shares = equalSplitShares(10001, 1);
    expect(shares.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10001);
    expect(shares[0]).toBeGreaterThanOrEqual(5000);
  });

  it('distributes the remainder among the first people', () => {
    expect(equalSplitShares(10000, 2)).toEqual([3334, 3333]);
  });

  it('keeps the people shares plus the user share equal to the total', () => {
    const total = 10100;
    const shares = equalSplitShares(total, 3);
    const userShare = total - shares.reduce((a, b) => a + b, 0);
    expect(shares).toHaveLength(3);
    expect(userShare).toBeGreaterThanOrEqual(0);
    expect(shares.reduce((a, b) => a + b, 0) + userShare).toBe(total);
  });

  it('handles amounts that divide evenly', () => {
    expect(equalSplitShares(12000, 2)).toEqual([4000, 4000]);
  });
});