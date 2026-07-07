import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, noise2D } from './random';

describe('hashString', () => {
  it('is stable for known inputs', () => {
    expect(hashString('treasure-island:admiral-benbow-inn:')).toBe(
      hashString('treasure-island:admiral-benbow-inn:'),
    );
    expect(hashString('')).toBe(0x811c9dc5);
  });

  it('distinguishes different inputs', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('treasure-island:a:')).not.toBe(hashString('treasure-island:b:'));
  });
});

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('yields values in [0, 1)', () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('noise2D', () => {
  it('is deterministic', () => {
    expect(noise2D(7, 1.5, 2.5)).toBe(noise2D(7, 1.5, 2.5));
  });

  it('stays in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = noise2D(99, i * 0.37, i * 0.53);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('varies across space', () => {
    const values = new Set<number>();
    for (let i = 0; i < 50; i++) {
      values.add(noise2D(5, i * 0.71, i * 1.13));
    }
    expect(values.size).toBeGreaterThan(10);
  });
});
