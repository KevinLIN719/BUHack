import { cp, readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Keep the standalone component notebook and legacy delivery entries.
await import('./build-preview.mjs');
const frontend = resolve(root, 'v3');
const output = resolve(root, 'dist');
for (const name of ['js', 'css']) {
  await cp(resolve(frontend, name), resolve(output, name), { recursive: true });
}
for (const name of await readdir(frontend)) {
  if (extname(name) === '.html') await cp(resolve(frontend, name), resolve(output, name));
}
console.log('Built Policy Lens v3 with camera capture and the component notebook.');
