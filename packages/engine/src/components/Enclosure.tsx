import { BackSide } from 'three';
import type { LocationBlueprint } from '../world/blueprint';

/** Setting-driven shell around the walkable area: room, cave dome, or ship hull. */
export function Enclosure({ blueprint }: { blueprint: LocationBlueprint }) {
  const { enclosure, palette, boundsRadius } = blueprint;
  if (!enclosure) return null;

  switch (enclosure.kind) {
    case 'room': {
      const half = boundsRadius + 0.5;
      const h = enclosure.height;
      const wallArgs: [number, number, number] = [half * 2 + 0.4, h, 0.4];
      return (
        <group>
          <mesh position={[0, h / 2, -half]}>
            <boxGeometry args={wallArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[0, h / 2, half]}>
            <boxGeometry args={wallArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[-half, h / 2, 0]} rotation-y={Math.PI / 2}>
            <boxGeometry args={wallArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[half, h / 2, 0]} rotation-y={Math.PI / 2}>
            <boxGeometry args={wallArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[0, h, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[half * 2 + 0.4, half * 2 + 0.4]} />
            <meshStandardMaterial color={palette.ground} flatShading />
          </mesh>
        </group>
      );
    }
    case 'cave-dome':
      return (
        <mesh position-y={0.5} scale={[1, enclosure.height / (boundsRadius * 1.15), 1]}>
          <sphereGeometry args={[boundsRadius * 1.15, 20, 12]} />
          <meshStandardMaterial color={palette.secondary} flatShading side={BackSide} />
        </mesh>
      );
    case 'hull': {
      // rails along the deck edges + two masts + a stern cabin
      const half = boundsRadius + 0.4;
      const railH = enclosure.height;
      const railArgs: [number, number, number] = [half * 2, railH, 0.25];
      return (
        <group>
          <mesh position={[0, railH / 2, -half]}>
            <boxGeometry args={railArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[0, railH / 2, half]}>
            <boxGeometry args={railArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[-half, railH / 2, 0]} rotation-y={Math.PI / 2}>
            <boxGeometry args={railArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[half, railH / 2, 0]} rotation-y={Math.PI / 2}>
            <boxGeometry args={railArgs} />
            <meshStandardMaterial color={palette.secondary} flatShading />
          </mesh>
          <mesh position={[boundsRadius * 0.45, 7, 0]}>
            <cylinderGeometry args={[0.18, 0.28, 14, 6]} />
            <meshStandardMaterial color={palette.primary} flatShading />
          </mesh>
          <mesh position={[-boundsRadius * 0.45, 6, 0]}>
            <cylinderGeometry args={[0.15, 0.24, 12, 6]} />
            <meshStandardMaterial color={palette.primary} flatShading />
          </mesh>
          <mesh position={[0, 1, -boundsRadius * 0.7]}>
            <boxGeometry args={[boundsRadius * 0.8, 2, boundsRadius * 0.35]} />
            <meshStandardMaterial color={palette.primary} flatShading />
          </mesh>
        </group>
      );
    }
  }
}
