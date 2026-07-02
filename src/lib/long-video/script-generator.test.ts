import { describe, it, expect } from 'vitest';
import { validateTargetDuration, calculateTargetWordCount } from './script-generator';

describe('validateTargetDuration', () => {
  it('returns true for valid integers in [1, 20]', () => {
    expect(validateTargetDuration(1)).toBe(true);
    expect(validateTargetDuration(10)).toBe(true);
    expect(validateTargetDuration(12)).toBe(true);
    expect(validateTargetDuration(20)).toBe(true);
  });

  it('returns false for zero', () => {
    expect(validateTargetDuration(0)).toBe(false);
  });

  it('returns false for negative numbers', () => {
    expect(validateTargetDuration(-1)).toBe(false);
    expect(validateTargetDuration(-100)).toBe(false);
  });

  it('returns false for values greater than 20', () => {
    expect(validateTargetDuration(21)).toBe(false);
    expect(validateTargetDuration(100)).toBe(false);
  });

  it('returns false for non-integer values', () => {
    expect(validateTargetDuration(1.5)).toBe(false);
    expect(validateTargetDuration(10.1)).toBe(false);
    expect(validateTargetDuration(19.9)).toBe(false);
  });

  it('returns false for NaN and Infinity', () => {
    expect(validateTargetDuration(NaN)).toBe(false);
    expect(validateTargetDuration(Infinity)).toBe(false);
    expect(validateTargetDuration(-Infinity)).toBe(false);
  });
});

describe('calculateTargetWordCount', () => {
  it('returns minutes × 130 for valid durations', () => {
    expect(calculateTargetWordCount(1)).toBe(130);
    expect(calculateTargetWordCount(12)).toBe(1560);
    expect(calculateTargetWordCount(20)).toBe(2600);
  });

  it('returns correct word count for the default duration of 12 minutes', () => {
    expect(calculateTargetWordCount(12)).toBe(1560);
  });

  it('scales linearly with input', () => {
    const count5 = calculateTargetWordCount(5);
    const count10 = calculateTargetWordCount(10);
    expect(count10).toBe(count5 * 2);
  });
});
