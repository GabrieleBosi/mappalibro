import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import { useWorldStore } from '../state/worldStore';
import { generateBlueprint } from '../world/blueprint';
import { Hud } from '../ui/Hud';
import { LocationScene } from './LocationScene';

export function PlayerView() {
  const spec = useWorldStore((s) => s.spec);
  const currentLocationId = useWorldStore((s) => s.currentLocationId);
  const locationsById = useWorldStore((s) => s.locationsById);
  const arrivalKey = useWorldStore((s) => s.arrivalKey);

  const location = currentLocationId ? locationsById.get(currentLocationId) : undefined;
  const blueprint = useMemo(
    () => (spec && location ? generateBlueprint(spec.book.slug, location) : null),
    [spec, location],
  );

  if (!spec || !location || !blueprint) return null;

  return (
    <div className="player-view">
      <Canvas camera={{ fov: 70, position: [0, 1.6, 6], near: 0.1, far: 600 }} dpr={[1, 2]}>
        <LocationScene key={`${location.id}:${arrivalKey}`} blueprint={blueprint} />
        {/* Temporary Step-A camera; replaced by first-person controls in Step B */}
        <OrbitControls target={[0, 1.4, 0]} />
      </Canvas>
      <Hud />
    </div>
  );
}
