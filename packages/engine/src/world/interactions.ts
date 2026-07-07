import type { Interaction, Location } from '../spec/worldSpec';

/**
 * Pure placement for a location's interactions (quotes, quizzes, …).
 * Markers sit on a ring between the spawn point and the portal ring,
 * deterministically ordered by interaction id and offset by half a step
 * so they never overlap portal positions.
 */

export interface InteractionPlacement {
  interaction: Interaction;
  position: [number, number, number];
  angle: number;
}

/** Marker ring radius as a fraction of the walkable bounds. */
export const INTERACTION_RING = 0.55;

export function computeInteractionPlacements(
  location: Location,
  boundsRadius: number,
): InteractionPlacement[] {
  const interactions = [...(location.interactions ?? [])].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const n = interactions.length;
  if (n === 0) return [];
  const radius = Math.max(1.5, boundsRadius * INTERACTION_RING);
  return interactions.map((interaction, i) => {
    // half-step offset from the portal ring's starting angle (-PI/2)
    const angle = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n;
    return {
      interaction,
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
      angle,
    };
  });
}
