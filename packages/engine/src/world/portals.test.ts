import { describe, expect, it } from 'vitest';
import treasureJson from '../../../../content/treasure-island/spec.json';
import { parseWorldSpec } from '../spec/worldSpec';
import { PORTAL_INSET, computePortalPlacements } from './portals';

const spec = parseWorldSpec(treasureJson);
const RADIUS = 18;

describe('computePortalPlacements', () => {
  it('places one portal per undirected edge at each end', () => {
    expect(computePortalPlacements('admiral-benbow-inn', spec, RADIUS)).toHaveLength(1);
    expect(computePortalPlacements('bristol-docks', spec, RADIUS)).toHaveLength(2);
    expect(computePortalPlacements('the-hispaniola', spec, RADIUS)).toHaveLength(1);
  });

  it('resolves the far end of the edge as the target', () => {
    const [fromInn] = computePortalPlacements('admiral-benbow-inn', spec, RADIUS);
    expect(fromInn?.targetLocationId).toBe('bristol-docks');
    expect(fromInn?.targetName).toBe('Bristol Docks');
    const docksTargets = computePortalPlacements('bristol-docks', spec, RADIUS)
      .map((p) => p.targetLocationId)
      .sort();
    expect(docksTargets).toEqual(['admiral-benbow-inn', 'the-hispaniola']);
  });

  it('shows the same narrative for both directions of an edge', () => {
    const [fromInn] = computePortalPlacements('admiral-benbow-inn', spec, RADIUS);
    const backFromDocks = computePortalPlacements('bristol-docks', spec, RADIUS).find(
      (p) => p.targetLocationId === 'admiral-benbow-inn',
    );
    expect(fromInn?.narrative).toBeTruthy();
    expect(backFromDocks?.narrative).toBe(fromInn?.narrative);
  });

  it('places portals on the perimeter ring, first one in front of spawn (-Z)', () => {
    const placements = computePortalPlacements('bristol-docks', spec, RADIUS);
    for (const p of placements) {
      expect(Math.hypot(p.position[0], p.position[2])).toBeCloseTo(RADIUS - PORTAL_INSET);
    }
    const first = placements[0];
    expect(first?.position[2]).toBeCloseTo(-(RADIUS - PORTAL_INSET));
    expect(first?.position[0]).toBeCloseTo(0);
  });

  it('is deterministic and sorted by target id', () => {
    const a = computePortalPlacements('bristol-docks', spec, RADIUS);
    const b = computePortalPlacements('bristol-docks', spec, RADIUS);
    expect(a).toEqual(b);
    expect(a.map((p) => p.targetLocationId)).toEqual(
      [...a.map((p) => p.targetLocationId)].sort(),
    );
  });

  it('ignores edges pointing at unknown locations', () => {
    const broken = {
      ...spec,
      paths: [...spec.paths, { from: 'admiral-benbow-inn', to: 'ghost-town' }],
    };
    expect(computePortalPlacements('admiral-benbow-inn', broken, RADIUS)).toHaveLength(1);
  });

  it('returns no portals for an isolated location', () => {
    expect(computePortalPlacements('nowhere', spec, RADIUS)).toEqual([]);
  });
});
