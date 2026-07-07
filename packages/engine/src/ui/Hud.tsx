import { useEffect } from 'react';
import { isCoarsePointer } from '../controls/input';
import { useWorldStore } from '../state/worldStore';
import type { Interaction } from '../spec/worldSpec';

const BANNER_AUTO_DISMISS_MS = 9000;

function interactionVerb(interaction: Interaction): string {
  switch (interaction.type) {
    case 'quote':
      return 'read the quote';
    case 'quiz':
      return 'try the quiz';
    case 'dialogue':
      return 'talk';
    case 'object':
      return 'take a look';
  }
}

export function Hud() {
  const spec = useWorldStore((s) => s.spec);
  const bannerLocationId = useWorldStore((s) => s.bannerLocationId);
  const locationsById = useWorldStore((s) => s.locationsById);
  const dismissBanner = useWorldStore((s) => s.dismissBanner);
  const nearbyPortal = useWorldStore((s) => s.nearbyPortal);
  const nearbyInteraction = useWorldStore((s) => s.nearbyInteraction);
  const activeInteraction = useWorldStore((s) => s.activeInteraction);
  const beginTravel = useWorldStore((s) => s.beginTravel);
  const openInteraction = useWorldStore((s) => s.openInteraction);
  const pointerLocked = useWorldStore((s) => s.pointerLocked);
  const phase = useWorldStore((s) => s.transition.phase);
  const xp = useWorldStore((s) => s.xp);

  const touch = isCoarsePointer();
  const bannerLocation = bannerLocationId ? locationsById.get(bannerLocationId) : undefined;

  useEffect(() => {
    if (!bannerLocation) return;
    const t = setTimeout(dismissBanner, BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [bannerLocation, dismissBanner]);

  if (!spec) return null;

  const idle = phase === 'idle' && !activeInteraction;
  const showPortalPrompt = idle && nearbyPortal;
  const showInteractionPrompt = idle && !nearbyPortal && nearbyInteraction;

  return (
    <div className="hud">
      <div className="hud-book">
        <strong>{spec.book.title}</strong>
        <span> · {spec.book.author}</span>
      </div>
      <div className="hud-xp" aria-label={`${xp} experience points`}>
        ✦ {xp} XP
      </div>
      {!touch && !pointerLocked && idle && (
        <div className="hud-hint">Click to look around · WASD to walk</div>
      )}
      {showPortalPrompt && (
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
      {showInteractionPrompt && (
        <div className="hud-prompt">
          {nearbyInteraction.interaction.prompt && (
            <p className="hud-prompt-flavor">{nearbyInteraction.interaction.prompt}</p>
          )}
          {touch ? (
            <button type="button" onClick={() => openInteraction(nearbyInteraction)}>
              {interactionVerb(nearbyInteraction.interaction)}
            </button>
          ) : (
            <span>
              Press <kbd>E</kbd> to {interactionVerb(nearbyInteraction.interaction)}
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
