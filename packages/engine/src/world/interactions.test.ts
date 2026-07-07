import { describe, expect, it } from 'vitest';
import treasureJson from '../../../../content/treasure-island/spec.json';
import { parseWorldSpec, type Location } from '../spec/worldSpec';
import { INTERACTION_RING, computeInteractionPlacements } from './interactions';

const spec = parseWorldSpec(treasureJson);
const RADIUS = 8;

function loc(id: string): Location {
  const found = spec.locations.find((l) => l.id === id);
  if (!found) throw new Error(`missing location ${id}`);
  return found;
}

describe('computeInteractionPlacements', () => {
  it('places one marker per interaction', () => {
    for (const location of spec.locations) {
      const placements = computeInteractionPlacements(location, RADIUS);
      expect(placements).toHaveLength(location.interactions?.length ?? 0);
    }
  });

  it('is deterministic and sorted by interaction id', () => {
    const a = computeInteractionPlacements(loc('admiral-benbow-inn'), RADIUS);
    const b = computeInteractionPlacements(loc('admiral-benbow-inn'), RADIUS);
    expect(a).toEqual(b);
    const ids = a.map((p) => p.interaction.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('places markers on the inner ring, clear of spawn and portals', () => {
    const placements = computeInteractionPlacements(loc('admiral-benbow-inn'), RADIUS);
    for (const p of placements) {
      const d = Math.hypot(p.position[0], p.position[2]);
      expect(d).toBeCloseTo(Math.max(1.5, RADIUS * INTERACTION_RING));
      expect(d).toBeLessThan(RADIUS - 1.5); // inside the portal ring
      expect(d).toBeGreaterThan(1); // not on the spawn point
    }
  });

  it('does not collide with the portal ring start angle (-PI/2)', () => {
    const placements = computeInteractionPlacements(loc('admiral-benbow-inn'), RADIUS);
    for (const p of placements) {
      expect(Math.abs(p.angle - -Math.PI / 2)).toBeGreaterThan(0.1);
    }
  });

  it('handles a location without interactions', () => {
    const bare: Location = {
      id: 'bare',
      name: 'Bare',
      description: 'Empty.',
      chapterRefs: [1],
      environment: { setting: 'indoor', mood: 'serene', scale: 'intimate' },
    };
    expect(computeInteractionPlacements(bare, RADIUS)).toEqual([]);
  });

  it('places every interaction type, including object/dialogue', () => {
    const mixed: Location = {
      id: 'mixed',
      name: 'Mixed',
      description: 'All types.',
      chapterRefs: [1],
      environment: { setting: 'indoor', mood: 'serene', scale: 'intimate' },
      interactions: [
        { id: 'a-object', type: 'object', xp: 10 },
        { id: 'b-dialogue', type: 'dialogue', xp: 10 },
        { id: 'c-quote', type: 'quote', quote: { text: 'x', chapter: 1 }, xp: 10 },
      ],
    };
    expect(computeInteractionPlacements(mixed, RADIUS)).toHaveLength(3);
  });
});
