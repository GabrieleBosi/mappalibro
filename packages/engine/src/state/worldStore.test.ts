import { beforeEach, describe, expect, it } from 'vitest';
import treasureJson from '../../../../content/treasure-island/spec.json';
import { useWorldStore } from './worldStore';

function fetchStub(body: unknown, status = 200): typeof fetch {
  return async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

function resetStore() {
  useWorldStore.setState({
    status: 'idle',
    error: null,
    errorKind: null,
    spec: null,
    locationsById: new Map(),
    currentLocationId: null,
    arrivalKey: 0,
    bannerLocationId: null,
    transition: { phase: 'idle', narrative: null, targetLocationId: null },
    nearbyPortal: null,
    pointerLocked: false,
  });
}

describe('worldStore.loadSpec', () => {
  beforeEach(resetStore);

  it('loads a valid spec and starts at entryLocation', async () => {
    await useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub(treasureJson),
    });
    const s = useWorldStore.getState();
    expect(s.status).toBe('ready');
    expect(s.spec?.book.title).toBe('Treasure Island');
    expect(s.currentLocationId).toBe('admiral-benbow-inn');
    expect(s.bannerLocationId).toBe('admiral-benbow-inn');
    expect(s.arrivalKey).toBe(1);
    expect(s.locationsById.size).toBe(3);
  });

  it('honors a valid location override', async () => {
    await useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub(treasureJson),
      locationOverride: 'bristol-docks',
    });
    expect(useWorldStore.getState().currentLocationId).toBe('bristol-docks');
  });

  it('falls back to entryLocation for an unknown override', async () => {
    await useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub(treasureJson),
      locationOverride: 'nowhere',
    });
    expect(useWorldStore.getState().currentLocationId).toBe('admiral-benbow-inn');
  });

  it('reports not-found for a 404', async () => {
    await useWorldStore.getState().loadSpec('nope', {
      fetchFn: fetchStub('', 404),
    });
    const s = useWorldStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorKind).toBe('not-found');
    expect(s.error).toContain('nope');
  });

  it('reports invalid for malformed JSON', async () => {
    await useWorldStore.getState().loadSpec('bad', {
      fetchFn: fetchStub('{not json'),
    });
    const s = useWorldStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorKind).toBe('invalid');
  });

  it('reports invalid for a spec that fails schema validation', async () => {
    await useWorldStore.getState().loadSpec('bad', {
      fetchFn: fetchStub({ specVersion: '9.9' }),
    });
    const s = useWorldStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorKind).toBe('invalid');
    expect(s.error).toContain('validation');
  });

  it('reports network errors from a rejecting fetch', async () => {
    const rejectingFetch: typeof fetch = async () => {
      throw new Error('offline');
    };
    await useWorldStore.getState().loadSpec('any', { fetchFn: rejectingFetch });
    const s = useWorldStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorKind).toBe('network');
  });

  it('ignores duplicate loads (StrictMode double effect)', async () => {
    const first = useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub(treasureJson),
    });
    const second = useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub('', 404), // would error if it actually ran
    });
    await Promise.all([first, second]);
    expect(useWorldStore.getState().status).toBe('ready');
  });

  it('dismissBanner clears the banner', async () => {
    await useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub(treasureJson),
    });
    useWorldStore.getState().dismissBanner();
    expect(useWorldStore.getState().bannerLocationId).toBeNull();
  });
});

describe('worldStore transition machine', () => {
  const portal = {
    targetLocationId: 'bristol-docks',
    targetName: 'Bristol Docks',
    narrative: 'Jim rides the mail coach through the night to Bristol.',
    unlockedBy: null,
    position: [0, 0, -16.5] as [number, number, number],
    angle: -Math.PI / 2,
  };

  beforeEach(async () => {
    resetStore();
    await useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub(treasureJson),
    });
  });

  it('runs the full travel sequence and arrives at the target', () => {
    const s = () => useWorldStore.getState();
    const startArrivalKey = s().arrivalKey;

    s().beginTravel(portal);
    expect(s().transition.phase).toBe('fading-out');
    expect(s().transition.narrative).toBe(portal.narrative);
    expect(s().currentLocationId).toBe('admiral-benbow-inn'); // not yet moved

    s().showNarrative();
    expect(s().transition.phase).toBe('narrative');

    s().completeArrival();
    expect(s().transition.phase).toBe('fading-in');
    expect(s().currentLocationId).toBe('bristol-docks');
    expect(s().arrivalKey).toBe(startArrivalKey + 1);
    expect(s().bannerLocationId).toBe('bristol-docks');

    s().finishTransition();
    expect(s().transition.phase).toBe('idle');
    expect(s().transition.targetLocationId).toBeNull();
  });

  it('skips the narrative phase when the path has none', () => {
    const s = () => useWorldStore.getState();
    s().beginTravel({ ...portal, narrative: null });
    // overlay goes straight from fading-out to arrival
    s().completeArrival();
    expect(s().transition.phase).toBe('fading-in');
    expect(s().currentLocationId).toBe('bristol-docks');
  });

  it('ignores beginTravel while a transition is in flight', () => {
    const s = () => useWorldStore.getState();
    s().beginTravel(portal);
    s().beginTravel({ ...portal, targetLocationId: 'the-hispaniola' });
    expect(s().transition.targetLocationId).toBe('bristol-docks');
  });

  it('ignores beginTravel toward an unknown location', () => {
    const s = () => useWorldStore.getState();
    s().beginTravel({ ...portal, targetLocationId: 'nowhere' });
    expect(s().transition.phase).toBe('idle');
  });

  it('ignores out-of-order machine calls', () => {
    const s = () => useWorldStore.getState();
    s().showNarrative();
    s().completeArrival();
    s().finishTransition();
    expect(s().transition.phase).toBe('idle');
    expect(s().currentLocationId).toBe('admiral-benbow-inn');
  });

  it('clears the nearby portal and banner when travel begins', () => {
    const s = () => useWorldStore.getState();
    s().setNearbyPortal(portal);
    s().beginTravel(portal);
    expect(s().nearbyPortal).toBeNull();
    expect(s().bannerLocationId).toBeNull();
  });
});
