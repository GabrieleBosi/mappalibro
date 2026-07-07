import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { useWorldStore } from '../state/worldStore';
import type { Palette } from '../world/blueprint';
import type { InteractionPlacement } from '../world/interactions';

/** Within this range the HUD shows the interaction prompt. */
const PROMPT_RANGE = 2.8;
/** Proximity polling interval, seconds. */
const CHECK_INTERVAL = 0.2;

function Marker({
  placement,
  palette,
}: {
  placement: InteractionPlacement;
  palette: Palette;
}) {
  const iconRef = useRef<Group>(null);
  const completed = useWorldStore((s) =>
    s.completedInteractions.has(placement.interaction.id),
  );
  const isQuiz = placement.interaction.type === 'quiz';
  const glow = completed ? palette.secondary : isQuiz ? palette.portal : palette.emissive;

  useFrame((state) => {
    const icon = iconRef.current;
    if (icon) {
      const t = state.clock.elapsedTime;
      icon.position.y = 1.35 + Math.sin(t * 1.6 + placement.angle * 3) * 0.12;
      icon.rotation.y = t * 0.8;
    }
  });

  return (
    <group position={placement.position}>
      <mesh position-y={0.25}>
        <cylinderGeometry args={[0.3, 0.42, 0.5, 6]} />
        <meshStandardMaterial color={palette.secondary} flatShading />
      </mesh>
      <group ref={iconRef}>
        {isQuiz ? (
          <mesh>
            <icosahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial
              color={glow}
              emissive={glow}
              emissiveIntensity={completed ? 0.15 : 1.1}
              flatShading
            />
          </mesh>
        ) : (
          <mesh>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial
              color={glow}
              emissive={glow}
              emissiveIntensity={completed ? 0.15 : 1.1}
              flatShading
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

/**
 * Interaction markers + proximity detection. Throttled like Portals; only
 * writes to the store when the nearby interaction actually changes.
 */
export function InteractionMarkers({
  placements,
  palette,
}: {
  placements: InteractionPlacement[];
  palette: Palette;
}) {
  const lastCheck = useRef(-Infinity);

  useFrame((state) => {
    if (placements.length === 0) return;
    if (state.clock.elapsedTime - lastCheck.current < CHECK_INTERVAL) return;
    lastCheck.current = state.clock.elapsedTime;

    const store = useWorldStore.getState();
    if (store.transition.phase !== 'idle' || store.activeInteraction) return;

    const cam = state.camera.position;
    let nearest: InteractionPlacement | null = null;
    let nearestDist = Infinity;
    for (const p of placements) {
      const d = Math.hypot(cam.x - p.position[0], cam.z - p.position[2]);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }

    if (nearest && nearestDist < PROMPT_RANGE) {
      if (store.nearbyInteraction?.interaction.id !== nearest.interaction.id) {
        store.setNearbyInteraction(nearest);
      }
    } else if (store.nearbyInteraction) {
      store.setNearbyInteraction(null);
    }
  });

  return (
    <group>
      {placements.map((p) => (
        <Marker key={p.interaction.id} placement={p} palette={palette} />
      ))}
    </group>
  );
}
