#!/usr/bin/env node
/**
 * Validates every content/<book-slug>/spec.json against
 * schemas/world-spec.schema.json, then runs the structural checks the JSON
 * Schema cannot express:
 *   (a) every location is reachable from entryLocation via the paths graph
 *   (b) every chapter reference (location chapterRefs, quote.chapter,
 *       quiz.chapterRef) exists in that book's chapters.json
 *
 * Exits non-zero on any error. Passing with zero book packs is fine.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'schemas', 'world-spec.schema.json');
const contentDir = path.join(root, 'content');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));

/** @returns {string[]} error messages for this book pack */
function checkBookPack(slug) {
  const errors = [];
  const packDir = path.join(contentDir, slug);
  const specPath = path.join(packDir, 'spec.json');

  if (!existsSync(specPath)) {
    return [`missing spec.json`];
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return [`spec.json is not valid JSON: ${err.message}`];
  }

  // 1. JSON Schema validation
  if (!validateSchema(spec)) {
    for (const err of validateSchema.errors ?? []) {
      errors.push(`schema: ${err.instancePath || '/'} ${err.message}`);
    }
    return errors; // structural checks assume a schema-valid spec
  }

  const locationIds = new Set(spec.locations.map((loc) => loc.id));

  // 2. Referential integrity of the graph
  if (!locationIds.has(spec.entryLocation)) {
    errors.push(`entryLocation "${spec.entryLocation}" is not a defined location`);
  }
  for (const edge of spec.paths) {
    for (const end of [edge.from, edge.to]) {
      if (!locationIds.has(end)) {
        errors.push(`path ${edge.from} -> ${edge.to}: unknown location "${end}"`);
      }
    }
  }

  // 3. Reachability: BFS over undirected paths from entryLocation
  if (locationIds.has(spec.entryLocation)) {
    const adjacency = new Map([...locationIds].map((id) => [id, []]));
    for (const edge of spec.paths) {
      if (locationIds.has(edge.from) && locationIds.has(edge.to)) {
        adjacency.get(edge.from).push(edge.to);
        adjacency.get(edge.to).push(edge.from);
      }
    }
    const visited = new Set([spec.entryLocation]);
    const queue = [spec.entryLocation];
    while (queue.length > 0) {
      for (const next of adjacency.get(queue.shift())) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    for (const id of locationIds) {
      if (!visited.has(id)) {
        errors.push(`location "${id}" is not reachable from entryLocation "${spec.entryLocation}"`);
      }
    }
  }

  // 4. Chapter references must exist in chapters.json
  const chaptersPath = path.join(packDir, 'chapters.json');
  if (!existsSync(chaptersPath)) {
    errors.push(`missing chapters.json (required to verify chapterRefs)`);
  } else {
    let chapters;
    try {
      chapters = JSON.parse(readFileSync(chaptersPath, 'utf8'));
    } catch (err) {
      return [...errors, `chapters.json is not valid JSON: ${err.message}`];
    }
    const chapterNumbers = new Set(
      (Array.isArray(chapters) ? chapters : []).map((ch) => ch.number),
    );
    const checkRef = (ref, where) => {
      if (!chapterNumbers.has(ref)) {
        errors.push(`${where}: chapter ${ref} does not exist in chapters.json`);
      }
    };
    for (const loc of spec.locations) {
      for (const ref of loc.chapterRefs) {
        checkRef(ref, `location "${loc.id}" chapterRefs`);
      }
      for (const interaction of loc.interactions ?? []) {
        if (interaction.quote) {
          checkRef(interaction.quote.chapter, `interaction "${interaction.id}" quote.chapter`);
        }
        if (interaction.quiz?.chapterRef !== undefined) {
          checkRef(interaction.quiz.chapterRef, `interaction "${interaction.id}" quiz.chapterRef`);
        }
      }
    }

    // Chapter offsets must land on their headings in source.txt. Read raw —
    // no newline normalization — so CRLF conversion or edits that shift the
    // recorded char offsets fail loudly here instead of at runtime.
    const sourcePath = path.join(packDir, 'source.txt');
    if (!existsSync(sourcePath)) {
      errors.push(`missing source.txt (required to verify chapter offsets)`);
    } else {
      const text = readFileSync(sourcePath, 'utf8');
      for (const chapter of Array.isArray(chapters) ? chapters : []) {
        const { number, title, start, end } = chapter;
        if (
          !Number.isInteger(start) || !Number.isInteger(end) ||
          start < 0 || start >= end || end > text.length
        ) {
          errors.push(
            `chapters.json: chapter ${number} offsets [${start}, ${end}) out of range (source.txt is ${text.length} chars)`,
          );
          continue;
        }
        if (title && !text.slice(start, Math.min(start + 300, end)).includes(title)) {
          errors.push(
            `chapters.json: chapter ${number} title ${JSON.stringify(title)} not found at offset ${start} — offsets have drifted (check line endings)`,
          );
        }
      }
    }
  }

  // 5. Character references must exist
  const characterIds = new Set((spec.characters ?? []).map((ch) => ch.id));
  for (const loc of spec.locations) {
    for (const charId of loc.characters ?? []) {
      if (!characterIds.has(charId)) {
        errors.push(`location "${loc.id}": unknown character "${charId}"`);
      }
    }
  }

  return errors;
}

const slugs = existsSync(contentDir)
  ? readdirSync(contentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

let failed = false;
for (const slug of slugs) {
  const errors = checkBookPack(slug);
  if (errors.length === 0) {
    console.log(`OK   content/${slug}`);
  } else {
    failed = true;
    console.error(`FAIL content/${slug}`);
    for (const message of errors) {
      console.error(`  - ${message}`);
    }
  }
}

if (slugs.length === 0) {
  console.log('No book packs in content/ — nothing to validate.');
}
if (failed) {
  process.exit(1);
}
console.log(`Validated ${slugs.length} book pack(s).`);
