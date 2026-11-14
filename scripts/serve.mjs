import { createServer, request as proxyRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const publicFiles = new Set(['/viewport-layout.js','/experience.html','/experience.js','/experience.css','/experience-data.js','/experience-chat.js','/showcase.html','/surface-motion.js','/showcase.css','/showcase.js','/showcase-chat.js','/hero-transition.js','/hero-transition.css','/ui-theme.css','/ui-notebook.css','/ui-markers.css','/liquid-controls.js','/liquid-controls.css','/policy-fixtures.js','/policy-deck.js','/policy-deck.css','/policy-pull.js','/policy-pull.css','/policy-workbench.js', '/refine.css', '/toggle-motion.js', '/index.html', '/completion-preview.html', '/concept-preview.html', '/styles.css', '/controls.css', '/agent.css', '/completion.css', '/concept.css', '/app.js', '/demo-data.js', '/agent-replies.js', '/agent-motion.js', '/completion-motion.js', '/completion-preview.js', '/concept-motion.js', '/concept-data.js', '/concept-preview.js']);
for (const file of ['/materials.html','/materials.css','/materials.js','/report.css','/report.js','/i18n.css','/i18n.js','/translations.js']) publicFiles.add(file);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      const upstream = proxyRequest({ hostname: '127.0.0.1', port: Number(process.env.API_PORT || 3001),
        path: request.url, method: request.method, headers: request.headers }, incoming => {
        response.writeHead(incoming.statusCode || 502, incoming.headers);
        incoming.pipe(response);
      });
      upstream.setTimeout(30000, () => upstream.destroy(new Error('API timeout')));
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        if (!response.writableEnded) response.end(JSON.stringify({error:{message:'後端尚未連線，請先啟動 npm run dev:api。'}}));
      });
      request.on('aborted', () => upstream.destroy());
      response.on('close', () => { if (!response.writableEnded) upstream.destroy(); });
      request.pipe(upstream);
      return;
    }
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
