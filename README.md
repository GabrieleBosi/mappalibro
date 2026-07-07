# Mappalibro

**Walk through the worlds of public-domain books.**

Mappalibro turns classic literature into explorable, stylized 3D worlds. Pick a book, step into its locations, meet its characters, and learn the text through spatial interaction — verbatim quotes hidden where they were spoken, quizzes answerable from the chapter you're standing in, and paths that retrace the narrative itself.

**Live demo:** https://mappalibro.netlify.app
— try [Alice's Adventures in Wonderland](https://mappalibro.netlify.app/?book=alice-in-wonderland) or [Treasure Island](https://mappalibro.netlify.app/?book=treasure-island).

## The core idea

Books already contain worlds; nobody should have to hand-model them. Mappalibro treats a book as **data** and the 3D player as a **generic engine**:

- Every book is a *content pack*: the source text, a chapter index, and a `spec.json` describing its locations, characters, paths, and interactions.
- The engine procedurally generates each location from a handful of spec parameters (`setting`, `mood`, `scale`, `era`) using one stylized low-poly art system shared by all books.
- Learning content is never invented: every quote is verbatim from the source text and every quiz answer is traceable to a cited chapter — enforced by validation tooling, not convention.

## Strategy

**1. Content and engine are strictly separated.** Adding a book never requires engine changes — not even the home screen (it renders a manifest generated from the installed packs at build time). New visual variety comes from new spec parameters, never from book-specific code paths. This is the project's one non-negotiable rule, because it's what makes the library scale.

**2. The world-spec is a real contract.** [`schemas/world-spec.schema.json`](schemas/world-spec.schema.json) defines what a book pack is; Zod schemas mirror it at runtime. `npm run validate` checks every pack against the schema *plus* the invariants a schema can't express: every location reachable from the entry point, every chapter reference real, every chapter offset landing on its heading, every quoted passage present in the source. CI fails when content lies.

**3. Ingestion is a pipeline, not a chore.** `npm run ingest -- <gutenberg-id>` downloads a Project Gutenberg text, strips the boilerplate, and detects chapters with character-exact offsets. The editorial pass (choosing locations, extracting quotes, writing quizzes) is guided by a skill with a golden example ([`content/treasure-island/spec.json`](content/treasure-island/spec.json)), and anything low-confidence is flagged for human review before it ships.

**4. No backend, runs anywhere.** v1 is a fully static site: all book data ships as JSON, deployable to any static host, PWA-installable, targeting 60 fps on mid-range mobile (max ~50k triangles per location, lazy-loaded with only current + adjacent locations in memory).

**5. Public domain only.** Sources come from Standard Ebooks or Project Gutenberg, with provenance (source URL, license, retrieval date) recorded in every spec.

## Repository layout

```
packages/engine/    React Three Fiber player — rendering, navigation, interactions UI
content/<slug>/     One folder per book: spec.json, source.txt, chapters.json
schemas/            world-spec.schema.json — the contract between content and engine
scripts/            Ingestion + validation tooling
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Engine dev server (`?book=<slug>` selects a book) |
| `npm run validate` | Validate all packs: schema, reachability, chapter refs & offsets |
| `npm test` | Engine unit tests (vitest) |
| `npm run ingest -- <id\|path>` | Scaffold a new book pack from a Gutenberg ID or local text |

## Adding a book

1. `npm run ingest -- <gutenberg-id>` — downloads, cleans, and indexes the text.
2. Write `spec.json`: 6–12 locations for a novel, each with a grounded description, chapter references, environment parameters, one verbatim quote, and one quiz. Match the golden example's granularity.
3. `npm run validate` — must pass before the pack ships.
4. Build. The book appears on the home dashboard automatically.

## Tech

Vite · React · TypeScript (strict) · React Three Fiber · drei · zustand · Zod — deployed on Netlify.
