#!/usr/bin/env node
/**
 * Scaffolds a new book pack in content/<slug>/:
 *   - downloads the plain text (Project Gutenberg ID) or reads a local .txt
 *   - strips the Gutenberg header/footer boilerplate
 *   - detects chapter headings and writes chapters.json (number, title, start, end)
 *
 * It does NOT write spec.json — world extraction is a separate editorial pass
 * (see the ingest-book skill). Anything the heuristics are unsure about is
 * printed as a LOW-CONFIDENCE warning for human review.
 *
 * Usage: npm run ingest -- <gutenberg-id | path-to-txt> [--slug <slug>] [--force]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- args

const args = process.argv.slice(2);
const warnings = [];

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error('Usage: npm run ingest -- <gutenberg-id | path-to-txt> [--slug <slug>] [--force]');
  process.exit(1);
}

let source = null;
let slugOverride = null;
let force = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--slug') slugOverride = args[++i];
  else if (args[i] === '--force') force = true;
  else if (source === null) source = args[i];
  else usage(`unexpected argument "${args[i]}"`);
}
if (!source) usage('missing <gutenberg-id | path-to-txt>');

// ---------------------------------------------------------------- acquire

async function acquire(src) {
  if (/^\d+$/.test(src)) {
    const urls = [
      `https://www.gutenberg.org/cache/epub/${src}/pg${src}.txt`,
      `https://www.gutenberg.org/files/${src}/${src}-0.txt`,
    ];
    for (const url of urls) {
      const res = await fetch(url);
      if (res.ok) {
        return {
          text: await res.text(),
          sourceUrl: `https://www.gutenberg.org/ebooks/${src}`,
        };
      }
    }
    usage(`could not download Gutenberg eBook #${src} (tried ${urls.join(', ')})`);
  }
  if (/\.epub$/i.test(src)) {
    usage('epub input is not supported yet — pass a Gutenberg ID or a plain-text file');
  }
  if (!existsSync(src)) usage(`no such file: ${src}`);
  return { text: readFileSync(src, 'utf8'), sourceUrl: null };
}

// ---------------------------------------------------------------- metadata

/** Parse the "Title:" / "Author:" style header Gutenberg puts before the text. */
function parseMetadata(rawText) {
  const head = rawText.slice(0, 4000);
  const grab = (label) => head.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'))?.[1].trim() ?? null;
  return {
    title: grab('Title'),
    author: grab('Author'),
    language: grab('Language'),
    releaseDate: grab('Release date') ?? grab('Release Date'),
  };
}

// ---------------------------------------------------------------- boilerplate

function stripBoilerplate(rawText) {
  const startMarker = /^\s*\*\*\*\s*START OF TH(?:E|IS) PROJECT GUTENBERG EBOOK.*\*\*\*\s*$/im;
  const endMarker = /^\s*\*\*\*\s*END OF TH(?:E|IS) PROJECT GUTENBERG EBOOK.*\*\*\*\s*$/im;

  let text = rawText;
  const startMatch = text.match(startMarker);
  const endMatch = text.match(endMarker);
  if (startMatch && endMatch && endMatch.index > startMatch.index) {
    text = text.slice(startMatch.index + startMatch[0].length, endMatch.index);
  } else {
    warnings.push(
      'LOW-CONFIDENCE: Gutenberg START/END markers not found — using the whole file as source text. Check source.txt for leftover boilerplate.',
    );
  }

  // Transcriber artifacts: single-line [Illustration] / [Illustration: ...] tags.
  text = text.replace(/^\s*\[Illustration[^\]\n]*\]\s*$/gm, '');

  return text.replace(/^\s*\n/, '').trimEnd() + '\n';
}

// ---------------------------------------------------------------- chapters

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function parseChapterNumber(token) {
  if (/^\d+$/.test(token)) return Number(token);
  let value = 0;
  const up = token.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const digit = ROMAN[up[i]];
    if (!digit) return null;
    value += digit < (ROMAN[up[i + 1]] ?? 0) ? -digit : digit;
  }
  return value;
}

/** A line looks like a chapter title (not body prose) if it's short and not a sentence. */
function titleFromFollowingLines(lines, index) {
  for (let j = index + 1; j <= index + 2 && j < lines.length; j++) {
    const candidate = lines[j].text.trim();
    if (candidate === '') continue;
    if (candidate.length <= 80 && !/^[a-z]/.test(candidate)) return candidate;
    return null;
  }
  return null;
}

/**
 * Detect chapter headings. Returns [{number, title, start}] sorted by offset.
 * Two styles, tried in order:
 *   A. "CHAPTER I." / "Chapter 1: Title" lines (title inline or on the next line)
 *   B. a bare roman numeral / number line followed by a title line
 *      (Standard Ebooks / Treasure Island style) — fallback only
 */
function detectChapters(text) {
  const lines = [];
  let offset = 0;
  for (const lineText of text.split('\n')) {
    lines.push({ text: lineText, start: offset });
    offset += lineText.length + 1;
  }

  const styleA = [];
  const styleB = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text;

    const a = line.match(/^\s*CHAPTER\s+([IVXLCDM]+|\d+)\b[.:]?\s*(.*)$/i);
    if (a) {
      const number = parseChapterNumber(a[1]);
      if (number !== null) {
        const inlineTitle = a[2].trim().replace(/\s{2,}/g, ' ') || null;
        styleA.push({
          number,
          title: inlineTitle ?? titleFromFollowingLines(lines, i),
          start: lines[i].start,
        });
      }
      continue;
    }

    const b = line.match(/^\s*([IVXLCDM]+|\d{1,3})\.?\s*$/);
    if (b && lines[i - 1]?.text.trim() === '') {
      const number = parseChapterNumber(b[1]);
      const title = titleFromFollowingLines(lines, i);
      if (number !== null && number > 0 && title !== null) {
        styleB.push({ number, title, start: lines[i].start });
      }
    }
  }

  let candidates = styleA;
  if (styleA.length < 3 && styleB.length >= 3) {
    candidates = styleB;
    warnings.push(
      'LOW-CONFIDENCE: no "CHAPTER N" headings found — used bare-numeral heading detection, which is more error-prone. Verify chapters.json boundaries.',
    );
  }

  // A table of contents lists every heading once before the body repeats them:
  // when a chapter number occurs more than once, keep the LAST occurrence.
  const byNumber = new Map();
  let duplicates = 0;
  for (const candidate of candidates) {
    if (byNumber.has(candidate.number)) duplicates++;
    byNumber.set(candidate.number, candidate);
  }
  if (duplicates > 0) {
    console.log(`  (skipped ${duplicates} duplicate heading(s) — assumed table of contents)`);
  }

  const chapters = [...byNumber.values()].sort((x, y) => x.start - y.start);

  // Sanity checks → LOW-CONFIDENCE flags, not hard failures.
  chapters.forEach((chapter, i) => {
    if (chapter.number !== i + 1) {
      warnings.push(
        `LOW-CONFIDENCE: chapter numbering is not contiguous at position ${i + 1} (parsed number ${chapter.number}). A heading may be missed or spurious.`,
      );
    }
    if (!chapter.title) {
      warnings.push(`LOW-CONFIDENCE: chapter ${chapter.number} has no detectable title.`);
      chapter.title = '';
    }
  });

  return chapters;
}

// ---------------------------------------------------------------- main

const { text: rawText, sourceUrl } = await acquire(source);
const meta = parseMetadata(rawText);
const text = stripBoilerplate(rawText.replace(/\r\n/g, '\n'));

const slug =
  slugOverride ??
  meta.title
    ?.toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  usage(`could not derive a slug (title: ${JSON.stringify(meta.title)}) — pass --slug <slug>`);
}

const packDir = path.join(root, 'content', slug);
if (existsSync(packDir) && !force) {
  usage(`content/${slug}/ already exists — pass --force to overwrite source.txt and chapters.json`);
}

console.log(`Ingesting ${meta.title ?? source}${meta.author ? ` by ${meta.author}` : ''}`);

const chapters = detectChapters(text);
if (chapters.length === 0) {
  console.error('No chapter headings detected — wrote nothing.');
  console.error('Inspect the text and write chapters.json by hand, or extend detectChapters().');
  process.exit(1);
}
const chaptersJson = chapters.map((chapter, i) => ({
  number: chapter.number,
  title: chapter.title,
  start: chapter.start,
  end: i + 1 < chapters.length ? chapters[i + 1].start : text.length,
}));

mkdirSync(packDir, { recursive: true });
writeFileSync(path.join(packDir, 'source.txt'), text);
writeFileSync(path.join(packDir, 'chapters.json'), JSON.stringify(chaptersJson, null, 2) + '\n');

console.log(`\nWrote content/${slug}/source.txt (${text.length} chars)`);
console.log(`Wrote content/${slug}/chapters.json (${chaptersJson.length} chapters):`);
for (const chapter of chaptersJson) {
  console.log(`  ${String(chapter.number).padStart(3)}  ${chapter.title || '(untitled)'}`);
}

console.log('\nProvenance for spec.json:');
console.log(
  JSON.stringify(
    {
      sourceUrl: sourceUrl ?? `(local file: ${source})`,
      license: `Public domain — VERIFY (release: ${meta.releaseDate ?? 'unknown'})`,
      retrievedAt: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ),
);

if (warnings.length > 0) {
  console.log('\nFlags for human review:');
  for (const warning of warnings) console.log(`  ! ${warning}`);
}
console.log('\nNext: extract locations/characters/interactions into spec.json');
console.log(`(golden example: content/treasure-island/spec.json), then npm run validate.`);
