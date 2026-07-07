import { describe, expect, it } from 'vitest';
import { parseWorldSpec } from './worldSpec';

function minimalSpec() {
  return {
    specVersion: '1.0',
    book: {
      slug: 'test-book',
      title: 'Test Book',
      author: 'Test Author',
      language: 'en',
      year: 1900,
    },
    provenance: {
      sourceUrl: 'https://www.gutenberg.org/ebooks/1',
      license: 'Public domain (US, pre-1930)',
    },
    entryLocation: 'first-room',
    locations: [
      {
        id: 'first-room',
        name: 'First Room',
        description: 'A small test room where the story begins.',
        chapterRefs: [1],
        environment: {
          setting: 'indoor',
          mood: 'serene',
          scale: 'intimate',
        },
      },
    ],
    paths: [],
  };
}

describe('parseWorldSpec', () => {
  it('accepts a minimal valid spec', () => {
    const spec = parseWorldSpec(minimalSpec());
    expect(spec.book.slug).toBe('test-book');
    expect(spec.locations).toHaveLength(1);
  });

  it('applies the xp default on interactions', () => {
    const raw = minimalSpec();
    raw.locations[0] = {
      ...raw.locations[0]!,
      interactions: [{ id: 'find-the-map', type: 'object' }],
    } as never;
    const spec = parseWorldSpec(raw);
    expect(spec.locations[0]?.interactions?.[0]?.xp).toBe(10);
  });

  it('rejects an unknown specVersion', () => {
    const raw = { ...minimalSpec(), specVersion: '2.0' };
    expect(() => parseWorldSpec(raw)).toThrow();
  });

  it('rejects unknown top-level properties', () => {
    const raw = { ...minimalSpec(), extra: true };
    expect(() => parseWorldSpec(raw)).toThrow();
  });

  it('rejects a location id that violates the slug pattern', () => {
    const raw = minimalSpec();
    raw.locations[0]!.id = 'First Room';
    raw.entryLocation = 'First Room';
    expect(() => parseWorldSpec(raw)).toThrow();
  });

  it('rejects an empty locations array', () => {
    const raw = { ...minimalSpec(), locations: [] };
    expect(() => parseWorldSpec(raw)).toThrow();
  });

  it('rejects an invalid environment enum value', () => {
    const raw = minimalSpec();
    raw.locations[0]!.environment.mood = 'gloomy' as never;
    expect(() => parseWorldSpec(raw)).toThrow();
  });

  it('rejects chapterRefs below 1', () => {
    const raw = minimalSpec();
    raw.locations[0]!.chapterRefs = [0];
    expect(() => parseWorldSpec(raw)).toThrow();
  });
});
