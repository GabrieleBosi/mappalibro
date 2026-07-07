/**
 * Per-book learning progress (XP + completed interaction ids) persisted to
 * localStorage. Storage is injectable for tests and guarded everywhere:
 * private-mode/quota failures degrade to in-memory-only progress.
 */

export interface Progress {
  xp: number;
  completed: string[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function progressKey(slug: string): string {
  return `mappalibro:progress:${slug}`;
}

export function loadProgress(
  slug: string,
  storage: StorageLike | null = defaultStorage(),
): Progress {
  if (storage) {
    try {
      const raw = storage.getItem(progressKey(slug));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof (parsed as Progress).xp === 'number' &&
          Array.isArray((parsed as Progress).completed)
        ) {
          const p = parsed as Progress;
          return {
            xp: Math.max(0, p.xp),
            completed: p.completed.filter((id): id is string => typeof id === 'string'),
          };
        }
      }
    } catch {
      // corrupted entry or storage access error: start fresh
    }
  }
  return { xp: 0, completed: [] };
}

export function saveProgress(
  slug: string,
  progress: Progress,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(progressKey(slug), JSON.stringify(progress));
  } catch {
    // quota/private mode: progress stays in memory for this session
  }
}
