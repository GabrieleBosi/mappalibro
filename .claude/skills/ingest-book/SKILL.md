---
name: ingest-book
description: Ingest a public-domain book into a Mappalibro content pack. Use when the user wants to add a new book, providing a Project Gutenberg ID, Standard Ebooks URL, or local epub/txt path.
argument-hint: [gutenberg-id | url | path]
disable-model-invocation: true
---

Ingest a new book into `content/<slug>/` following this exact process. Do not skip steps.

## 1. Acquire & verify

- Download the plain-text version from the given source ($ARGUMENTS).
- Verify it is public domain (Gutenberg/Standard Ebooks, publication pre-1930).
  If unsure, STOP and ask the user.
- Save as `content/<slug>/source.txt`. Strip the Gutenberg header/footer boilerplate.
- Record `provenance` (sourceUrl, license, retrievedAt).

## 2. Structural pass

- Detect chapters; write `content/<slug>/chapters.json` (number, title, char offsets).
- Report chapter count to the user before continuing.

## 3. World extraction (the core pass)

Read the book chapter by chapter and extract into a draft spec:

- **Locations**: recurring, spatially distinct settings only. Target 6–12 for a
  novel, 3–5 for a novella. Merge near-duplicates. Each gets grounded
  `description`, `chapterRefs`, and `environment` parameters chosen from the
  schema enums — pick what the text actually supports.
- **Characters**: max 10, only those the reader must know.
- **Paths**: connect locations in narrative order; add shortcuts where the story
  supports them. The graph must be connected from `entryLocation`.
- **Interactions**: per location, 1 verbatim `quote` (copy EXACTLY from
  source.txt, cite chapter), 1 `quiz` answerable from the cited chapter, and
  optionally 1 `object` or `dialogue`. Never invent quotes.

Match the style and granularity of the golden example:
`content/treasure-island/spec.json`.

## 4. Validate & report

- Write `content/<slug>/spec.json`.
- Run `npm run validate`. Fix any errors and re-run until clean.
- Finish with a review report for the user:
  - locations table (id, name, chapters, mood/setting)
  - graph as an ASCII map
  - any LOW-CONFIDENCE items flagged for human review (ambiguous locations,
    quotes you're less than certain are verbatim)

Do not commit. The user reviews and polishes before merge.
