import { describe, expect, it } from 'vitest';
import treasureJson from '../../../../content/treasure-island/spec.json';
import {
  moodSchema,
  parseWorldSpec,
  scaleSchema,
  settingSchema,
  timeOfDaySchema,
  type Location,
} from '../spec/worldSpec';
import { generateBlueprint } from './blueprint';

const HEX = /^#[0-9a-f]{6}$/;

function makeLocation(overrides: Partial<Location['environment']>): Location {
  return {
    id: 'test-location',
    name: 'Test Location',
    description: 'A place.',
    chapterRefs: [1],
    environment: {
      setting: 'indoor',
      mood: 'serene',
      scale: 'medium',
      ...overrides,
    },
  };
}

describe('generateBlueprint', () => {
  it('is deterministic for the same book + location', () => {
    const loc = makeLocation({ era: '18th-century rural England', timeOfDay: 'night' });
    const a = generateBlueprint('treasure-island', loc);
    const b = generateBlueprint('treasure-island', loc);
    expect(a).toEqual(b);
  });

  it('differs across locations and books', () => {
    const loc = makeLocation({});
    const other = { ...loc, id: 'other-location' };
    expect(generateBlueprint('treasure-island', loc).seed).not.toBe(
      generateBlueprint('treasure-island', other).seed,
    );
    expect(generateBlueprint('treasure-island', loc).seed).not.toBe(
      generateBlueprint('moby-dick', loc).seed,
    );
  });

  describe('full environment matrix', () => {
    const settings = settingSchema.options;
    const moods = moodSchema.options;
    const scales = scaleSchema.options;
    const times = timeOfDaySchema.options;

    for (const setting of settings) {
      for (const mood of moods) {
        for (const scale of scales) {
          for (const timeOfDay of times) {
            it(`${setting}/${mood}/${scale}/${timeOfDay} satisfies the invariants`, () => {
              const bp = generateBlueprint(
                'matrix-book',
                makeLocation({ setting, mood, scale, timeOfDay }),
              );

              // triangle budget (CLAUDE.md: max ~50k per location)
              expect(bp.triangleEstimate).toBeLessThanOrEqual(50_000);

              // props exist and stay inside the walkable bounds, on the ground
              expect(bp.props.length).toBeGreaterThan(0);
              for (const p of bp.props) {
                expect(Math.hypot(p.position[0], p.position[2])).toBeLessThanOrEqual(
                  bp.boundsRadius,
                );
                expect(p.position[1]).toBe(0);
                for (const s of p.scale) expect(s).toBeGreaterThan(0);
              }

              // palette is well-formed hex
              for (const color of Object.values(bp.palette)) {
                expect(color).toMatch(HEX);
              }

              // enclosure present exactly for enclosed settings
              const enclosed = ['indoor', 'underground', 'vehicle'].includes(setting);
              if (enclosed) expect(bp.enclosure).not.toBeNull();
              else expect(bp.enclosure).toBeNull();

              // interior fill light exactly for enclosed settings
              if (enclosed) expect(bp.lighting.interior).not.toBeNull();
              else expect(bp.lighting.interior).toBeNull();

              // fog is sane
              expect(bp.lighting.fogFar).toBeGreaterThan(bp.lighting.fogNear);
              expect(bp.lighting.fogNear).toBeGreaterThan(0);

              expect(bp.boundsRadius).toBeGreaterThan(0);
              expect(bp.ground.size).toBeGreaterThanOrEqual(bp.boundsRadius * 2);
            });
          }
        }
      }
    }
  });

  it('renders the three treasure-island locations distinctly', () => {
    const spec = parseWorldSpec(treasureJson);
    const blueprints = spec.locations.map((loc) => generateBlueprint(spec.book.slug, loc));
    const groundKinds = blueprints.map((bp) => bp.ground.kind);
    // indoor inn, outdoor docks, ship deck
    expect(new Set(groundKinds).size).toBe(3);
    const skies = blueprints.map((bp) => bp.palette.sky);
    expect(new Set(skies).size).toBe(3);
    for (const bp of blueprints) {
      expect(bp.triangleEstimate).toBeLessThanOrEqual(50_000);
    }
  });
});
