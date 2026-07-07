import type { LocationBlueprint } from '../world/blueprint';
import { Enclosure } from './Enclosure';
import { Ground } from './Ground';
import { Props } from './Props';
import { SceneLighting } from './SceneLighting';

/**
 * Renders one location from its blueprint. Only the CURRENT location is
 * mounted at a time (the lazy-load boundary); remounting via key swaps
 * the whole scene.
 */
export function LocationScene({ blueprint }: { blueprint: LocationBlueprint }) {
  return (
    <group>
      <SceneLighting lighting={blueprint.lighting} />
      <Ground blueprint={blueprint} />
      <Enclosure blueprint={blueprint} />
      <Props props={blueprint.props} palette={blueprint.palette} />
    </group>
  );
}
