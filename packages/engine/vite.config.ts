import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(engineRoot, '../../content');

/**
 * Serves book packs from the monorepo's content/ directory at /content/* in
 * dev, and copies them into dist/content/ on build, so the same URL works on
 * any static host. Keeps the content/engine separation without symlinks.
 */
/** Manifest of available book packs, served at /content/index.json so the
 *  library screen stays data-driven — adding a book never touches the engine. */
function buildContentIndex(): string {
  const books = fs
    .readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const spec = JSON.parse(
          fs.readFileSync(path.join(contentRoot, entry.name, 'spec.json'), 'utf8'),
        );
        const { slug, title, author, year, summary } = spec.book;
        return [{ slug, title, author, year, summary }];
      } catch {
        return []; // pack without a valid spec.json yet — skip
      }
    });
  return JSON.stringify({ books }, null, 2);
}

function contentPacks(): Plugin {
  return {
    name: 'mappalibro-content-packs',
    configureServer(server) {
      server.middlewares.use('/content', (req, res) => {
        const urlPath = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
        if (urlPath === '/index.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(buildContentIndex());
          return;
        }
        const filePath = path.join(contentRoot, urlPath);
        // path.join normalizes '..' — anything escaping contentRoot is rejected
        if (!filePath.startsWith(contentRoot + path.sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          const type = filePath.endsWith('.json')
            ? 'application/json'
            : filePath.endsWith('.txt')
              ? 'text/plain; charset=utf-8'
              : 'application/octet-stream';
          res.setHeader('Content-Type', type);
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
    async writeBundle() {
      const distContent = path.resolve(engineRoot, 'dist/content');
      await fs.promises.cp(contentRoot, distContent, {
        recursive: true,
      });
      await fs.promises.writeFile(path.join(distContent, 'index.json'), buildContentIndex());
    },
  };
}

export default defineConfig({
  plugins: [react(), contentPacks()],
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
