import { ZodError } from 'zod';
import { parseWorldSpec, type WorldSpec } from '../spec/worldSpec';

export type SpecLoadErrorKind = 'not-found' | 'network' | 'invalid';

export class SpecLoadError extends Error {
  constructor(
    readonly kind: SpecLoadErrorKind,
    readonly slug: string,
    message: string,
  ) {
    super(message);
    this.name = 'SpecLoadError';
  }
}

/**
 * Fetch and validate a book pack spec. Book packs are static JSON served
 * from /content/<slug>/ in both dev and production builds.
 * fetchFn is injectable for tests.
 */
export async function fetchSpec(
  slug: string,
  fetchFn: typeof fetch = fetch,
): Promise<WorldSpec> {
  let res: Response;
  try {
    res = await fetchFn(`/content/${slug}/spec.json`);
  } catch (err) {
    throw new SpecLoadError('network', slug, err instanceof Error ? err.message : String(err));
  }
  if (res.status === 404) {
    throw new SpecLoadError('not-found', slug, `No book pack named "${slug}"`);
  }
  if (!res.ok) {
    throw new SpecLoadError('network', slug, `HTTP ${res.status} loading spec`);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new SpecLoadError('invalid', slug, 'spec.json is not valid JSON');
  }
  try {
    return parseWorldSpec(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const detail = first ? `${first.path.join('.')}: ${first.message}` : 'unknown issue';
      throw new SpecLoadError('invalid', slug, `spec.json failed validation — ${detail}`);
    }
    throw err;
  }
}
