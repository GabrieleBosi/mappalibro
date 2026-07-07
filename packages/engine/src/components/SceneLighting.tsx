import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Color, Fog } from 'three';
import type { LightingParams } from '../world/blueprint';

export function SceneLighting({ lighting }: { lighting: LightingParams }) {
  const scene = useThree((s) => s.scene);

  // Set on the scene object directly: this component renders nested inside a
  // group, so attach="background" / attach="fog" would target the wrong parent.
  useEffect(() => {
    scene.background = new Color(lighting.background);
    scene.fog = new Fog(lighting.fogColor, lighting.fogNear, lighting.fogFar);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, lighting]);

  return (
    <>
      <ambientLight intensity={lighting.ambientIntensity} />
      <directionalLight
        position={lighting.sunPosition}
        intensity={lighting.sunIntensity}
        color={lighting.sunColor}
      />
      {lighting.interior && (
        <pointLight
          position={lighting.interior.position}
          intensity={lighting.interior.intensity}
          color={lighting.interior.color}
        />
      )}
    </>
  );
}
