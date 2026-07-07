import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { consumeInteract } from '../controls/input';
import { useWorldStore } from '../state/worldStore';
import type { Palette } from '../world/blueprint';
import type { PortalPlacement } from '../world/portals';

/** Within this range the HUD shows the travel prompt. */
const PROMPT_RANGE = 3.2;
/** Walking this close triggers travel automatically. */
const TRIGGER_RANGE = 1.2;
/** Proximity polling interval, seconds (don't setState every frame). */
const CHECK_INTERVAL = 0.2;

function PortalMesh({
  placement,
  palette,
}: {
  placement: PortalPlacement;
  palette: Palette;
}) {
  const glowRef = useRef<Mesh>(null);
  // face the location center
  const rotationY = Math.atan2(-placement.position[0], -placement.position[2]);

  useFrame((state) => {
    const glow = glowRef.current;
    if (glow) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.04;
      glow.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <group position={placement.position} rotation-y={rotationY}>
      <mesh position={[-1.1, 1.5, 0]}>
        <boxGeometry args={[0.35, 3, 0.35]} />
        <meshStandardMaterial color={palette.secondary} flatShading />
      </mesh>
      <mesh position={[1.1, 1.5, 0]}>
        <boxGeometry args={[0.35, 3, 0.35]} />
        <meshStandardMaterial color={palette.secondary} flatShading />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[2.8, 0.4, 0.4]} />
        <meshStandardMaterial color={palette.secondary} flatShading />
      </mesh>
      <mesh ref={glowRef} position={[0, 1.5, 0]}>
        <planeGeometry args={[1.85, 2.9]} />
        <meshBasicMaterial color={palette.portal} transparent opacity={0.6} side={2} />
      </mesh>
    </group>
  );
}

/**
 * Portal meshes + proximity logic. Distance checks are throttled and only
 * write to the store when the nearby portal actually changes.
 */
export function Portals({
  placements,
  palette,
}: {
  placements: PortalPlacement[];
  palette: Palette;
}) {
  const camera = useThree((s) => s.camera);
  const lastCheck = useRef(-Infinity);

  useFrame((state) => {
    const store = useWorldStore.getState();

    if (consumeInteract()) {
      if (store.nearbyPortal && store.transition.phase === 'idle') {
        store.beginTravel(store.nearbyPortal);
        return;
      }
    }

    if (state.clock.elapsedTime - lastCheck.current < CHECK_INTERVAL) return;
    lastCheck.current = state.clock.elapsedTime;
    if (store.transition.phase !== 'idle') return;

    let nearest: PortalPlacement | null = null;
    let nearestDist = Infinity;
    for (const p of placements) {
      const d = Math.hypot(
        camera.position.x - p.position[0],
        camera.position.z - p.position[2],
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }

    if (nearest && nearestDist < TRIGGER_RANGE) {
      store.beginTravel(nearest);
    } else if (nearest && nearestDist < PROMPT_RANGE) {
      if (store.nearbyPortal?.targetLocationId !== nearest.targetLocationId) {
        store.setNearbyPortal(nearest);
      }
    } else if (store.nearbyPortal) {
      store.setNearbyPortal(null);
    }
  });

  return (
    <group>
      {placements.map((p) => (
        <PortalMesh key={p.targetLocationId} placement={p} palette={palette} />
      ))}
    </group>
  );
}
