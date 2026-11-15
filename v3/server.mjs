import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.ts';
import { Store } from '../server/store.ts';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));
const backendDir = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const dotenv = require('dotenv');
dotenv.config({ path: resolve(backendDir, '.env'), quiet: true });
dotenv.config({ path: resolve(frontendDir, '.env'), quiet: true });
const express = require('express');
const port = Number(process.env.POLICY_LENS_PORT ?? 4185);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('POLICY_LENS_PORT must be between 1 and 65535.');

process.umask(0o077);
const databasePath = process.env.POLICY_LENS_DATABASE_PATH
  ? resolve(process.env.POLICY_LENS_DATABASE_PATH)
  : resolve(backendDir, '.data/policy-lens-v3.sqlite');
const store = new Store(databasePath);
const api = createApp(store);
const site = express();

site.disable('x-powered-by');
site.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.path === '/api' || req.path.startsWith('/api/')) return api(req, res, next);
  next();
});
site.get(['/', '/index.html'], (_req, res) => res.sendFile(resolve(frontendDir, 'index.html')));
site.get(['/scan', '/scan.html'], (_req, res) => res.sendFile(resolve(frontendDir, 'scan.html')));
site.use('/js', express.static(resolve(frontendDir, 'js'), { dotfiles: 'deny', index: false }));
site.use('/css', express.static(resolve(frontendDir, 'css'), { dotfiles: 'deny', index: false }));
site.use((_req, res) => res.status(404).send('Not found'));

const server = site.listen(port, '127.0.0.1', () => {
  console.log(`Policy Lens 已启动：http://localhost:${port}`);
  console.log('关闭此窗口或按 Control-C 可停止服务。');
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await api.locals.close();
  store.close();
}
server.once('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请先关闭占用该端口的程序。` : error);
  void shutdown().finally(() => { process.exitCode = 1; });
});
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
