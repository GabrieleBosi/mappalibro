import { useEffect } from 'react';
import { isCoarsePointer } from '../controls/input';
import { useWorldStore } from '../state/worldStore';

const BANNER_AUTO_DISMISS_MS = 9000;

export function Hud() {
  const spec = useWorldStore((s) => s.spec);
  const bannerLocationId = useWorldStore((s) => s.bannerLocationId);
  const locationsById = useWorldStore((s) => s.locationsById);
  const dismissBanner = useWorldStore((s) => s.dismissBanner);
  const nearbyPortal = useWorldStore((s) => s.nearbyPortal);
  const beginTravel = useWorldStore((s) => s.beginTravel);
  const pointerLocked = useWorldStore((s) => s.pointerLocked);
  const phase = useWorldStore((s) => s.transition.phase);

  const touch = isCoarsePointer();
  const bannerLocation = bannerLocationId ? locationsById.get(bannerLocationId) : undefined;

  useEffect(() => {
    if (!bannerLocation) return;
    const t = setTimeout(dismissBanner, BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [bannerLocation, dismissBanner]);

  if (!spec) return null;

  const showPrompt = nearbyPortal && phase === 'idle';

  return (
    <div className="hud">
      <div className="hud-book">
        <strong>{spec.book.title}</strong>
        <span> · {spec.book.author}</span>
      </div>
      {!touch && !pointerLocked && phase === 'idle' && (
        <div className="hud-hint">Click to look around · WASD to walk</div>
      )}
      {showPrompt && (
        <div className="hud-prompt">
          {touch ? (
            <button type="button" onClick={() => beginTravel(nearbyPortal)}>
              Travel to {nearbyPortal.targetName}
            </button>
          ) : (
            <span>
              Press <kbd>E</kbd> to travel to <strong>{nearbyPortal.targetName}</strong>
            </span>
          )}
        </div>
      )}
      {bannerLocation && (
        <div className="hud-banner" onClick={dismissBanner}>
          <h2>{bannerLocation.name}</h2>
          <p>{bannerLocation.description}</p>
        </div>
      )}
    </div>
  );
}
