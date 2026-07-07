import { useMemo } from 'react';
import { PlaneGeometry } from 'three';
import type { LocationBlueprint } from '../world/blueprint';
import { noise2D } from '../world/random';

/**
 * Low-poly displaced plane for terrain/cave grounds. Vertices inside the
 * walkable radius stay flat (player collision is a simple clamp, no raycast);
 * hills ramp up beyond it and fade into fog.
 */
function useDisplacedPlane(
  seed: number,
  size: number,
  segments: number,
  amplitude: number,
  flatRadius: number,
) {
  return useMemo(() => {
    const geo = new PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const d = Math.hypot(x, z);
        const ramp = Math.min(1, Math.max(0, (d - flatRadius) / (flatRadius * 0.6 + 1)));
        const n = noise2D(seed, x * 0.15 + 100, z * 0.15 + 100);
        pos.setY(i, n * amplitude * ramp);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [seed, size, segments, amplitude, flatRadius]);
}

export function Ground({ blueprint }: { blueprint: LocationBlueprint }) {
  const { ground, palette, seed, boundsRadius } = blueprint;
  const displaced = useDisplacedPlane(
    seed,
    ground.size,
    Math.max(1, ground.segments),
    ground.heightAmplitude,
    boundsRadius,
  );

  switch (ground.kind) {
    case 'floor':
      return (
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[ground.size, ground.size]} />
          <meshStandardMaterial color={palette.ground} flatShading />
        </mesh>
      );
    case 'terrain':
    case 'cave':
      return (
        <mesh geometry={displaced} receiveShadow>
          <meshStandardMaterial color={palette.ground} flatShading />
        </mesh>
      );
    case 'water':
      return (
        <group>
          <mesh rotation-x={-Math.PI / 2} position-y={-0.35}>
            <planeGeometry args={[ground.size, ground.size, ground.segments, ground.segments]} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          {/* walkable island/raft matching the collision bounds */}
          <mesh position-y={-0.3}>
            <cylinderGeometry args={[boundsRadius + 0.8, boundsRadius + 1.6, 0.6, 22]} />
            <meshStandardMaterial color={palette.ground} flatShading />
          </mesh>
        </group>
      );
    case 'deck':
      return (
        <mesh position-y={-0.2}>
          <boxGeometry args={[ground.size * 1.1, 0.4, ground.size]} />
          <meshStandardMaterial color={palette.ground} flatShading />
        </mesh>
      );
  }
}
