import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const publicFiles = new Set(['/viewport-layout.js','/experience.html','/experience.js','/experience.css','/experience-data.js','/experience-chat.js','/showcase.html','/surface-motion.js','/showcase.css','/showcase.js','/showcase-chat.js','/hero-transition.js','/hero-transition.css','/ui-theme.css','/ui-notebook.css','/ui-markers.css','/liquid-controls.js','/liquid-controls.css','/policy-fixtures.js','/policy-deck.js','/policy-deck.css','/policy-pull.js','/policy-pull.css','/policy-workbench.js', '/refine.css', '/toggle-motion.js', '/index.html', '/completion-preview.html', '/concept-preview.html', '/styles.css', '/controls.css', '/agent.css', '/completion.css', '/concept.css', '/app.js', '/demo-data.js', '/agent-replies.js', '/agent-motion.js', '/completion-motion.js', '/completion-preview.js', '/concept-motion.js', '/concept-data.js', '/concept-preview.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = pathname === '/' ? '/experience.html' : pathname;
    if (!publicFiles.has(path) && !path.startsWith('/assets/')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const filename = resolve(root, `.${path}`);
    if (!filename.startsWith(`${root}${sep}`) || !(await stat(filename)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(filename));
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Policy Lens interaction notebook: http://localhost:${port}`));
