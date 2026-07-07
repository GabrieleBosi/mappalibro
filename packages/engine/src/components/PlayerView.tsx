import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { isCoarsePointer } from '../controls/input';
import { Joystick } from '../controls/Joystick';
import { TouchLook } from '../controls/TouchLook';
import { useWorldStore } from '../state/worldStore';
import { generateBlueprint } from '../world/blueprint';
import { computePortalPlacements } from '../world/portals';
import { Hud } from '../ui/Hud';
import { TransitionOverlay } from '../ui/TransitionOverlay';
import { LocationScene } from './LocationScene';
import { Player } from './Player';
import { Portals } from './Portals';

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
  const portals = useMemo(
    () =>
      spec && location && blueprint
        ? computePortalPlacements(location.id, spec, blueprint.boundsRadius)
        : [],
    [spec, location, blueprint],
  );

  if (!spec || !location || !blueprint) return null;

  const touch = isCoarsePointer();
  const sceneKey = `${location.id}:${arrivalKey}`;

  return (
    <div className="player-view">
      <Canvas camera={{ fov: 70, position: [0, 1.6, 0], near: 0.1, far: 600 }} dpr={[1, 2]}>
        <LocationScene key={sceneKey} blueprint={blueprint} />
        <Portals key={`portals-${sceneKey}`} placements={portals} palette={blueprint.palette} />
        <Player key={`player-${sceneKey}`} blueprint={blueprint} />
      </Canvas>
      {touch && (
        <>
          <TouchLook />
          <Joystick />
        </>
      )}
      <Hud />
      <TransitionOverlay />
    </div>
  );
}
