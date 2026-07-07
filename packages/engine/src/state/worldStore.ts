import { create } from 'zustand';
import { SpecLoadError, fetchSpec } from '../loader/loadSpec';
import type { Location, WorldSpec } from '../spec/worldSpec';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LoadOptions {
  /** Debug/verification hook: start at this location instead of entryLocation. */
  locationOverride?: string | null;
  /** Injectable for tests. */
  fetchFn?: typeof fetch;
}

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

  loadSpec(slug: string, options?: LoadOptions): Promise<void>;
  dismissBanner(): void;
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
}));
