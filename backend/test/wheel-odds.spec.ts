import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ECONOMY_DEFAULTS } from '@palmsight/shared';
import {
  PAID_WHEEL_WEIGHTS,
  WHEEL_WEIGHTS,
} from '../src/currency/currency.service';

const expectedPrize = (weights: readonly number[]) => {
  const total = weights.reduce((sum, w) => sum + w, 0);
  return (
    weights.reduce(
      (sum, w, i) => sum + w * ECONOMY_DEFAULTS.WHEEL_PRIZES[i],
      0,
    ) / total
  );
};

describe('wheel odds', () => {
  it('has one weight per prize', () => {
    expect(WHEEL_WEIGHTS).toHaveLength(ECONOMY_DEFAULTS.WHEEL_PRIZES.length);
    expect(PAID_WHEEL_WEIGHTS).toHaveLength(
      ECONOMY_DEFAULTS.WHEEL_PRIZES.length,
    );
  });

  it('pays less than the paid spin costs, so repeated spins cannot mint GEM', () => {
    expect(expectedPrize(PAID_WHEEL_WEIGHTS)).toBeLessThan(
      ECONOMY_DEFAULTS.CURRENCY_SPIN_COST,
    );
  });
});
