import { create } from 'zustand';
import { SpecLoadError, fetchSpec } from '../loader/loadSpec';
import type { Location, WorldSpec } from '../spec/worldSpec';
import type { PortalPlacement } from '../world/portals';

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
  /** Desktop pointer-lock state, for the "click to look" hint. */
  pointerLocked: boolean;

  loadSpec(slug: string, options?: LoadOptions): Promise<void>;
  dismissBanner(): void;
  beginTravel(portal: PortalPlacement): void;
  showNarrative(): void;
  completeArrival(): void;
  finishTransition(): void;
  setNearbyPortal(portal: PortalPlacement | null): void;
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
      set({
        status: 'ready',
        error: null,
        errorKind: null,
        spec,
        locationsById,
        currentLocationId: startId,
        arrivalKey: 1,
        bannerLocationId: startId,
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
    if (s.status !== 'ready' || s.transition.phase !== 'idle') return;
    if (!s.locationsById.has(portal.targetLocationId)) return;
    set({
      transition: {
        phase: 'fading-out',
        narrative: portal.narrative,
        targetLocationId: portal.targetLocationId,
      },
      nearbyPortal: null,
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

  setPointerLocked(locked) {
    set({ pointerLocked: locked });
  },
}));
