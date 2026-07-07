import { describe, expect, it } from 'vitest';
import { loadProgress, progressKey, saveProgress } from './progress';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

describe('progress persistence', () => {
  it('round-trips xp and completed ids', () => {
    const storage = fakeStorage();
    saveProgress('treasure-island', { xp: 30, completed: ['a', 'b'] }, storage);
    expect(loadProgress('treasure-island', storage)).toEqual({
      xp: 30,
      completed: ['a', 'b'],
    });
  });

  it('keeps books separate', () => {
    const storage = fakeStorage();
    saveProgress('book-a', { xp: 10, completed: ['x'] }, storage);
    expect(loadProgress('book-b', storage)).toEqual({ xp: 0, completed: [] });
  });

  it('returns zero progress when nothing is stored', () => {
    expect(loadProgress('treasure-island', fakeStorage())).toEqual({
      xp: 0,
      completed: [],
    });
  });

  it('recovers from corrupted JSON', () => {
    const storage = fakeStorage({ [progressKey('t')]: '{not json' });
    expect(loadProgress('t', storage)).toEqual({ xp: 0, completed: [] });
  });

  it('recovers from a wrong shape and filters junk entries', () => {
    const bad = fakeStorage({ [progressKey('t')]: '{"xp":"lots","completed":{}}' });
    expect(loadProgress('t', bad)).toEqual({ xp: 0, completed: [] });
    const junk = fakeStorage({
      [progressKey('t')]: '{"xp":-5,"completed":["ok",42,null]}',
    });
    expect(loadProgress('t', junk)).toEqual({ xp: 0, completed: ['ok'] });
  });

  it('does not throw without storage', () => {
    expect(loadProgress('t', null)).toEqual({ xp: 0, completed: [] });
    expect(() => saveProgress('t', { xp: 1, completed: [] }, null)).not.toThrow();
  });

  it('does not throw when storage writes fail (quota/private mode)', () => {
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => saveProgress('t', { xp: 1, completed: [] }, throwing)).not.toThrow();
  });
});
