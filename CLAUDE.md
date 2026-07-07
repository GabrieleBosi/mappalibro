# Mappalibro

Explorable 3D worlds generated from public-domain books. Users walk through a book's
locations, meet its characters, and learn the text through spatial interaction.

## Architecture (non-negotiable)

- **Content and engine are strictly separated.** The engine is a generic player.
  Books are data packs. Adding a book must NEVER require engine changes.
- **No backend for v1.** Static site, all book data shipped as JSON. PWA-installable.
- Monorepo layout:
  - `packages/engine/` — React Three Fiber player (rendering, navigation, interactions UI)
  - `content/<book-slug>/` — one folder per book: `spec.json`, `source.txt`, `assets/`
  - `schemas/world-spec.schema.json` — the contract between content and engine
  - `scripts/` — ingestion + validation tooling

## The world-spec contract

- Every `content/*/spec.json` MUST validate against `schemas/world-spec.schema.json`.
- Every location MUST be reachable from `entryLocation` via the `paths` graph.
- Every `chapterRefs` entry MUST point to a real chapter in `source.txt`.
- Schema changes require: bump `specVersion`, migrate all existing specs in the
  same PR, update the ingest skill. Never break published books silently.

## Engine rules

- Stylized low-poly procedural geometry only. Locations are generated from spec
  parameters (`mood`, `setting`, `era`, `scale`) — never hand-modeled per book.
- One art system for all books. New visual variety = new spec parameters, not new code paths.
- Target: 60fps on mid-range mobile. Max ~50k triangles per loaded location.
  Lazy-load locations; only current + adjacent locations in memory.
- Tech: Vite + React + TypeScript (strict) + React Three Fiber + drei + zustand.
- Zod schemas in `packages/engine/src/spec/` mirror the JSON Schema and are the
  runtime source of truth for parsing.

## Content rules

- Public domain sources only: Standard Ebooks preferred, Project Gutenberg fallback.
  Record source URL + license note in each spec's `provenance` field.
- All learning content (quotes, quiz answers) must be traceable to the source text —
  no invented quotes, ever.

## Commands

- `npm run dev` — engine dev server with the book selected via `?book=<slug>`
- `npm run validate` — validate all specs against schema + reachability check
- `npm test` — engine unit tests (vitest)
- `npm run ingest -- <gutenberg-id-or-epub-path>` — scaffold a new book pack

## Workflow conventions

- Plan before large changes; prefer small, verifiable steps.
- After any content change, ALWAYS run `npm run validate` before finishing.
- After any engine change, run `npm test` and load `treasure-island` as smoke test.
- Golden example: `content/treasure-island/spec.json` — when in doubt about spec
  style or granularity, match it.
