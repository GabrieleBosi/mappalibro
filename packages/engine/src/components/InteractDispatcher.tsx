import { useFrame } from '@react-three/fiber';
import { consumeInteract } from '../controls/input';
import { useWorldStore } from '../state/worldStore';

/**
 * Single consumer of the edge-triggered interact input, so portals and
 * interaction markers can't race for the same key press. Priority:
 * open panel (E closes read-only panels) > portal travel > open interaction.
 */
export function InteractDispatcher() {
  useFrame(() => {
    if (!consumeInteract()) return;
    const s = useWorldStore.getState();
    if (s.transition.phase !== 'idle') return;
    if (s.activeInteraction) {
      // E closes quote/object/dialogue panels; quizzes need an explicit
      // click so an accidental key press can't dismiss the question
      if (s.activeInteraction.interaction.type !== 'quiz') s.closeInteraction();
      return;
    }
    if (s.nearbyPortal) {
      s.beginTravel(s.nearbyPortal);
    } else if (s.nearbyInteraction) {
      s.openInteraction(s.nearbyInteraction);
    }
  });
  return null;
}
