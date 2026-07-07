import { create } from 'zustand';
import { SpecLoadError, fetchSpec } from '../loader/loadSpec';
import type { Location, WorldSpec } from '../spec/worldSpec';
import type { InteractionPlacement } from '../world/interactions';
import type { PortalPlacement } from '../world/portals';
import { loadProgress, saveProgress } from './progress';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Travel state machine (timing is owned by TransitionOverlay, not the store):
 * idle -> fading-out -> narrative -> fading-in -> idle
 * The narrative phase is skipped when the path has no narrative text.
 */
export type TransitionPhase = 'idle' | 'fading-out' | 'narrative' | 'fading-in';

export interface TransitionState {
  phase: TransitionPhase;
  narrative: string | null;
  targetLocationId: string | null;
}

export interface LoadOptions {
  /** Debug/verification hook: start at this location instead of entryLocation. */
  locationOverride?: string | null;
  /** Injectable for tests. */
  fetchFn?: typeof fetch;
}

const IDLE_TRANSITION: TransitionState = {
  phase: 'idle',
  narrative: null,
  targetLocationId: null,
};

interface WorldState {
  status: LoadStatus;
  /** Human-readable message when status === 'error'. */
  error: string | null;
  errorKind: SpecLoadError['kind'] | null;
  spec: WorldSpec | null;
  locationsById: Map<string, Location>;
  currentLocationId: string | null;
  /** Bumped on every arrival; keys Player/scene remounts. */
  arrivalKey: number;
  /** Location whose name/description is shown in the arrival banner. */
  bannerLocationId: string | null;
  transition: TransitionState;
  /** Portal the player is standing near, for the HUD prompt. */
  nearbyPortal: PortalPlacement | null;
  /** Interaction marker the player is standing near, for the HUD prompt. */
  nearbyInteraction: InteractionPlacement | null;
  /** Interaction whose panel is currently open (freezes movement). */
  activeInteraction: InteractionPlacement | null;
  /** Learning progress, persisted per book to localStorage. */
  xp: number;
  completedInteractions: Set<string>;
  /** Desktop pointer-lock state, for the "click to look" hint. */
  pointerLocked: boolean;

  loadSpec(slug: string, options?: LoadOptions): Promise<void>;
  dismissBanner(): void;
  beginTravel(portal: PortalPlacement): void;
  showNarrative(): void;
  completeArrival(): void;
  finishTransition(): void;
  setNearbyPortal(portal: PortalPlacement | null): void;
  setNearbyInteraction(placement: InteractionPlacement | null): void;
  openInteraction(placement: InteractionPlacement): void;
  closeInteraction(): void;
  /** Award XP for an interaction, once ever (persisted). */
  completeInteraction(id: string, xpGain: number): void;
  setPointerLocked(locked: boolean): void;
}

export const useWorldStore = create<WorldState>()((set, get) => ({
  status: 'idle',
  error: null,
  errorKind: null,
  spec: null,
  locationsById: new Map(),
  currentLocationId: null,
  arrivalKey: 0,
  bannerLocationId: null,
  transition: IDLE_TRANSITION,
  nearbyPortal: null,
  nearbyInteraction: null,
  activeInteraction: null,
  xp: 0,
  completedInteractions: new Set<string>(),
  pointerLocked: false,

  async loadSpec(slug, options = {}) {
    // Guard against StrictMode double-invoked effects.
    if (get().status !== 'idle') return;
    set({ status: 'loading' });
    try {
      const spec = await fetchSpec(slug, options.fetchFn ?? fetch);
      const locationsById = new Map(spec.locations.map((loc) => [loc.id, loc]));
      if (!locationsById.has(spec.entryLocation)) {
        set({
          status: 'error',
          errorKind: 'invalid',
          error: `entryLocation "${spec.entryLocation}" is not a defined location`,
        });
        return;
      }
      const override = options.locationOverride;
      const startId =
        override && locationsById.has(override) ? override : spec.entryLocation;
      const progress = loadProgress(spec.book.slug);
      set({
        status: 'ready',
        error: null,
        errorKind: null,
        spec,
        locationsById,
        currentLocationId: startId,
        arrivalKey: 1,
        bannerLocationId: startId,
        xp: progress.xp,
        completedInteractions: new Set(progress.completed),
      });
    } catch (err) {
      if (err instanceof SpecLoadError) {
        set({ status: 'error', errorKind: err.kind, error: err.message });
      } else {
        set({
          status: 'error',
          errorKind: 'network',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },

  dismissBanner() {
    set({ bannerLocationId: null });
  },

  beginTravel(portal) {
    const s = get();
    if (s.status !== 'ready' || s.transition.phase !== 'idle' || s.activeInteraction) return;
    if (!s.locationsById.has(portal.targetLocationId)) return;
    set({
      transition: {
        phase: 'fading-out',
        narrative: portal.narrative,
        targetLocationId: portal.targetLocationId,
      },
      nearbyPortal: null,
      nearbyInteraction: null,
      bannerLocationId: null,
    });
  },

  showNarrative() {
    const s = get();
    if (s.transition.phase !== 'fading-out') return;
    set({ transition: { ...s.transition, phase: 'narrative' } });
  },

  completeArrival() {
    const s = get();
    const { phase, targetLocationId } = s.transition;
    if ((phase !== 'narrative' && phase !== 'fading-out') || !targetLocationId) return;
    set({
      currentLocationId: targetLocationId,
      arrivalKey: s.arrivalKey + 1,
      bannerLocationId: targetLocationId,
      transition: { ...s.transition, phase: 'fading-in' },
    });
  },

  finishTransition() {
    if (get().transition.phase !== 'fading-in') return;
    set({ transition: IDLE_TRANSITION });
  },

  setNearbyPortal(portal) {
    set({ nearbyPortal: portal });
  },

  setNearbyInteraction(placement) {
    set({ nearbyInteraction: placement });
  },

  openInteraction(placement) {
    const s = get();
    if (s.status !== 'ready' || s.transition.phase !== 'idle' || s.activeInteraction) return;
    set({ activeInteraction: placement, bannerLocationId: null });
    // quotes and simple interactions are "collected" on viewing;
    // quizzes award only via completeInteraction on a correct answer
    if (placement.interaction.type !== 'quiz') {
      get().completeInteraction(placement.interaction.id, placement.interaction.xp);
    }
  },

  closeInteraction() {
    set({ activeInteraction: null });
  },

  completeInteraction(id, xpGain) {
    const s = get();
    if (!s.spec || s.completedInteractions.has(id)) return;
    const completedInteractions = new Set(s.completedInteractions);
    completedInteractions.add(id);
    const xp = s.xp + xpGain;
    set({ completedInteractions, xp });
    saveProgress(s.spec.book.slug, { xp, completed: [...completedInteractions] });
  },

  setPointerLocked(locked) {
    set({ pointerLocked: locked });
  },
}));
