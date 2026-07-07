import type { EnclosureParams, GroundParams, LocationBlueprint, PropKind } from './blueprint';

/**
 * Static triangle-cost accounting so the ≤50k-per-location budget is a
 * testable invariant instead of a hope. Numbers match the low-seg primitives
 * used by the render components — update both together.
 */

export const TRIS_PER_KIND: Record<PropKind, number> = {
  block: 12, // box
  barrel: 36, // 6-sided cylinder, capped
  pillar: 36, // 6-sided cylinder, capped
  cone: 12, // 6-sided cone, open bottom + cap
  rock: 20, // icosahedron detail 0
  lamp: 48, // box post (12) + octahedron glow (8) + headroom
  plant: 24, // two crossed cones
};

const ENCLOSURE_TRIS: Record<EnclosureParams['kind'], number> = {
  room: 60, // 4 wall boxes + ceiling plane
  'cave-dome': 480, // backside sphere 20x12
  hull: 260, // deck rails + masts + cabin
};

/** Reserved headroom for portal archways added in the navigation layer. */
const PORTAL_RESERVE = 8 * 40;
/** Reserved headroom for interaction markers (pedestal + floating icon). */
const INTERACTION_RESERVE = 8 * 44;

function groundTris(ground: GroundParams): number {
  const plane = ground.segments * ground.segments * 2;
  // water renders an extra walkable island cylinder
  const island = ground.kind === 'water' ? 66 : 0;
  return plane + island;
}

export function estimateTriangles(
  bp: Omit<LocationBlueprint, 'triangleEstimate'>,
): number {
  const props = bp.props.reduce((sum, p) => sum + TRIS_PER_KIND[p.kind], 0);
  const enclosure = bp.enclosure ? ENCLOSURE_TRIS[bp.enclosure.kind] : 0;
  return groundTris(bp.ground) + props + enclosure + PORTAL_RESERVE + INTERACTION_RESERVE;
}
