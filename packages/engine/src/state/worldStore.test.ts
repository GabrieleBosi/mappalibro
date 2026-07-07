import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import treasureJson from '../../../../content/treasure-island/spec.json';
import { progressKey } from './progress';
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
    nearbyInteraction: null,
    activeInteraction: null,
    xp: 0,
    completedInteractions: new Set<string>(),
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

describe('worldStore interactions and XP', () => {
  const quotePlacement = {
    interaction: {
      id: 'benbow-quote-sea-song',
      type: 'quote' as const,
      prompt: 'Listen',
      quote: { text: 'Fifteen men on the dead man’s chest', chapter: 1 },
      xp: 10,
    },
    position: [3, 0, 2] as [number, number, number],
    angle: 0,
  };
  const quizPlacement = {
    interaction: {
      id: 'benbow-quiz-one-legged-man',
      type: 'quiz' as const,
      quiz: { question: 'Who?', options: ['A', 'B'], answerIndex: 0 },
      xp: 10,
    },
    position: [-3, 0, 2] as [number, number, number],
    angle: Math.PI,
  };

  function stubbedStorage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      get length() {
        return map.size;
      },
    };
    vi.stubGlobal('localStorage', storage);
    return map;
  }

  beforeEach(resetStore);
  afterEach(() => vi.unstubAllGlobals());

  async function load() {
    await useWorldStore.getState().loadSpec('treasure-island', {
      fetchFn: fetchStub(treasureJson),
    });
  }

  it('opening a quote awards its XP once and opens the panel', async () => {
    stubbedStorage();
    await load();
    const s = () => useWorldStore.getState();
    s().openInteraction(quotePlacement);
    expect(s().activeInteraction?.interaction.id).toBe('benbow-quote-sea-song');
    expect(s().xp).toBe(10);
    s().closeInteraction();
    s().openInteraction(quotePlacement);
    expect(s().xp).toBe(10); // no double award
  });

  it('opening a quiz does not award XP; a correct completion does, once', async () => {
    stubbedStorage();
    await load();
    const s = () => useWorldStore.getState();
    s().openInteraction(quizPlacement);
    expect(s().xp).toBe(0);
    s().completeInteraction(quizPlacement.interaction.id, quizPlacement.interaction.xp);
    expect(s().xp).toBe(10);
    s().completeInteraction(quizPlacement.interaction.id, quizPlacement.interaction.xp);
    expect(s().xp).toBe(10);
    expect(s().completedInteractions.has('benbow-quiz-one-legged-man')).toBe(true);
  });

  it('persists progress to localStorage and restores it on load', async () => {
    const map = stubbedStorage();
    await load();
    useWorldStore.getState().openInteraction(quotePlacement);
    const raw = map.get(progressKey('treasure-island'));
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw ?? '{}')).toEqual({
      xp: 10,
      completed: ['benbow-quote-sea-song'],
    });

    // fresh session: progress comes back
    resetStore();
    await load();
    const s = useWorldStore.getState();
    expect(s.xp).toBe(10);
    expect(s.completedInteractions.has('benbow-quote-sea-song')).toBe(true);
  });

  it('works without localStorage (node / private mode)', async () => {
    await load();
    const s = () => useWorldStore.getState();
    expect(() => s().openInteraction(quotePlacement)).not.toThrow();
    expect(s().xp).toBe(10);
  });

  it('ignores openInteraction while another panel or a transition is active', async () => {
    stubbedStorage();
    await load();
    const s = () => useWorldStore.getState();
    s().openInteraction(quotePlacement);
    s().openInteraction(quizPlacement);
    expect(s().activeInteraction?.interaction.id).toBe('benbow-quote-sea-song');
    s().closeInteraction();
    s().beginTravel({
      targetLocationId: 'bristol-docks',
      targetName: 'Bristol Docks',
      narrative: null,
      unlockedBy: null,
      position: [0, 0, -6.5],
      angle: -Math.PI / 2,
    });
    s().openInteraction(quizPlacement);
    expect(s().activeInteraction).toBeNull();
  });

  it('blocks travel while an interaction panel is open', async () => {
    stubbedStorage();
    await load();
    const s = () => useWorldStore.getState();
    s().openInteraction(quotePlacement);
    s().beginTravel({
      targetLocationId: 'bristol-docks',
      targetName: 'Bristol Docks',
      narrative: null,
      unlockedBy: null,
      position: [0, 0, -6.5],
      angle: -Math.PI / 2,
    });
    expect(s().transition.phase).toBe('idle');
  });
});
