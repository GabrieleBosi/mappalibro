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
function contentPacks(): Plugin {
  return {
    name: 'mappalibro-content-packs',
    configureServer(server) {
      server.middlewares.use('/content', (req, res) => {
        const urlPath = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
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
      await fs.promises.cp(contentRoot, path.resolve(engineRoot, 'dist/content'), {
        recursive: true,
      });
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
