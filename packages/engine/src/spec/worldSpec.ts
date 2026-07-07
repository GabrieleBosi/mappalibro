import { z } from 'zod';

/**
 * Zod mirror of schemas/world-spec.schema.json (specVersion 1.0).
 * This is the runtime source of truth for parsing book packs in the engine.
 * Any change here must stay in sync with the JSON Schema (and vice versa):
 * bump specVersion and migrate all published specs in the same PR.
 */

const idPattern = /^[a-z0-9-]+$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const settingSchema = z.enum([
  'indoor',
  'outdoor-land',
  'outdoor-water',
  'underground',
  'vehicle',
]);

export const moodSchema = z.enum([
  'serene',
  'tense',
  'mysterious',
  'joyful',
  'desolate',
  'grand',
]);

export const scaleSchema = z.enum(['intimate', 'medium', 'vast']);

export const timeOfDaySchema = z.enum(['dawn', 'day', 'dusk', 'night']);

export const environmentSchema = z
  .object({
    setting: settingSchema,
    mood: moodSchema,
    scale: scaleSchema,
    era: z.string().optional(),
    timeOfDay: timeOfDaySchema.optional(),
  })
  .strict();

export const quoteSchema = z.object({
  text: z.string(),
  chapter: z.number().int(),
});

export const quizSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  answerIndex: z.number().int().min(0),
  chapterRef: z.number().int().optional(),
});

export const interactionSchema = z
  .object({
    id: z.string().regex(idPattern),
    type: z.enum(['quote', 'quiz', 'object', 'dialogue']),
    prompt: z.string().optional(),
    quote: quoteSchema.optional(),
    quiz: quizSchema.optional(),
    xp: z.number().int().min(0).default(10),
  })
  .strict();

export const locationSchema = z
  .object({
    id: z.string().regex(idPattern),
    name: z.string(),
    description: z.string(),
    chapterRefs: z.array(z.number().int().min(1)).min(1),
    environment: environmentSchema,
    characters: z.array(z.string()).optional(),
    interactions: z.array(interactionSchema).optional(),
  })
  .strict();

export const characterSchema = z
  .object({
    id: z.string().regex(idPattern),
    name: z.string(),
    role: z.enum(['protagonist', 'antagonist', 'ally', 'minor', 'narrator']),
    description: z.string().max(400),
  })
  .strict();

export const pathSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    narrative: z.string().optional(),
    unlockedBy: z.string().optional(),
  })
  .strict();

export const bookSchema = z
  .object({
    slug: z.string().regex(idPattern),
    title: z.string(),
    author: z.string(),
    language: z.string().min(2).max(5),
    year: z.number().int(),
    summary: z.string().max(500).optional(),
  })
  .strict();

export const provenanceSchema = z
  .object({
    sourceUrl: z.string().url(),
    license: z.string(),
    retrievedAt: z.string().regex(isoDatePattern).optional(),
  })
  .strict();

export const worldSpecSchema = z
  .object({
    specVersion: z.literal('1.0'),
    book: bookSchema,
    provenance: provenanceSchema,
    entryLocation: z.string(),
    locations: z.array(locationSchema).min(1),
    characters: z.array(characterSchema).optional(),
    paths: z.array(pathSchema),
  })
  .strict();

export type Setting = z.infer<typeof settingSchema>;
export type Mood = z.infer<typeof moodSchema>;
export type Scale = z.infer<typeof scaleSchema>;
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type Interaction = z.infer<typeof interactionSchema>;
export type Location = z.infer<typeof locationSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Path = z.infer<typeof pathSchema>;
export type WorldSpec = z.infer<typeof worldSpecSchema>;

/** Parse untrusted JSON into a validated WorldSpec. Throws ZodError on failure. */
export function parseWorldSpec(data: unknown): WorldSpec {
  return worldSpecSchema.parse(data);
}
