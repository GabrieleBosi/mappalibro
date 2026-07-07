import { useEffect } from 'react';
import { useWorldStore } from '../state/worldStore';

const FADE_MS = 450;
/** Reading time scales with text length, within sane bounds. */
function narrativeMs(text: string): number {
  return Math.min(8000, Math.max(2600, 1200 + text.length * 40));
}

/**
 * Full-screen fade + narrative text between locations. Owns all timing;
 * the store's transition machine stays timer-free and unit-testable.
 * Always mounted so CSS opacity transitions run on phase changes.
 */
export function TransitionOverlay() {
  const phase = useWorldStore((s) => s.transition.phase);
  const narrative = useWorldStore((s) => s.transition.narrative);
  const showNarrative = useWorldStore((s) => s.showNarrative);
  const completeArrival = useWorldStore((s) => s.completeArrival);
  const finishTransition = useWorldStore((s) => s.finishTransition);

  useEffect(() => {
    switch (phase) {
      case 'fading-out': {
        const t = setTimeout(
          () => (narrative ? showNarrative() : completeArrival()),
          FADE_MS,
        );
        return () => clearTimeout(t);
      }
      case 'narrative': {
        const t = setTimeout(completeArrival, narrativeMs(narrative ?? ''));
        return () => clearTimeout(t);
      }
      case 'fading-in': {
        const t = setTimeout(finishTransition, FADE_MS);
        return () => clearTimeout(t);
      }
      case 'idle':
        return undefined;
    }
  }, [phase, narrative, showNarrative, completeArrival, finishTransition]);

  const dark = phase === 'fading-out' || phase === 'narrative';
  return (
    <div
      className={`transition-overlay${dark ? ' dark' : ''}`}
      style={{ pointerEvents: phase === 'idle' ? 'none' : 'auto' }}
    >
      {phase === 'narrative' && narrative && (
        <div className="transition-narrative">
          <p>{narrative}</p>
          <button type="button" onClick={completeArrival}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
