import type { WorldSpec } from '../spec/worldSpec';

/**
 * Pure portal placement from the undirected paths graph. A portal appears at
 * BOTH ends of every edge; the edge's narrative text is shown for travel in
 * either direction. Placement is deterministic: targets sorted by id, spread
 * evenly around the walkable perimeter starting in front of the spawn point.
 */

export interface PortalPlacement {
  targetLocationId: string;
  targetName: string;
  narrative: string | null;
  /** Interaction id gating this path (unused for now — all paths unlocked). */
  unlockedBy: string | null;
  position: [number, number, number];
  /** Angle around the perimeter, radians. */
  angle: number;
}

/** How far inside the walkable bounds the portal ring sits. */
export const PORTAL_INSET = 1.5;

export function computePortalPlacements(
  locationId: string,
  spec: WorldSpec,
  boundsRadius: number,
): PortalPlacement[] {
  const byId = new Map(spec.locations.map((loc) => [loc.id, loc]));
  const edges = new Map<string, { narrative: string | null; unlockedBy: string | null }>();
  for (const path of spec.paths) {
    const other =
      path.from === locationId ? path.to : path.to === locationId ? path.from : null;
    if (!other || !byId.has(other) || edges.has(other)) continue;
    edges.set(other, {
      narrative: path.narrative ?? null,
      unlockedBy: path.unlockedBy ?? null,
    });
  }
  const targets = [...edges.keys()].sort();
  const radius = Math.max(2, boundsRadius - PORTAL_INSET);
  return targets.map((targetId, i) => {
    // first portal straight ahead of spawn (-Z), the rest spread evenly
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / targets.length;
    const edge = edges.get(targetId);
    return {
      targetLocationId: targetId,
      targetName: byId.get(targetId)?.name ?? targetId,
      narrative: edge?.narrative ?? null,
      unlockedBy: edge?.unlockedBy ?? null,
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
      angle,
    };
  });
}
