import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
const mime = { '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.woff':'font/woff', '.woff2':'font/woff2' };
function localPath(path, base = root) {
  const value = decodeURIComponent(path.split(/[?#]/)[0]);
  const filename = resolve(base, value);
  if (!filename.startsWith(root + sep)) throw new Error(`Asset outside project: ${path}`);
  return filename;
}
function read(path) {
  if (!cache.has(path)) cache.set(path, readFile(path));
  return cache.get(path);
}
const text = async path => (await read(path)).toString('utf8');
const isLocal = path => !/^(?:[a-z]+:|\/\/|#)/i.test(path);
async function dataUri(path, base) {
  const filename = localPath(path,base);
  const type = mime[extname(filename).toLowerCase()];
  if (!type) throw new Error(`Unsupported inline asset: ${path}`);
  return `data:${type};base64,${(await read(filename)).toString('base64')}`;
}
async function replaceAsync(value, pattern, callback) {
  const matches = [...value.matchAll(pattern)];
  const results = await Promise.all(matches.map(callback));
  let index = 0;
  return value.replace(pattern, () => results[index++]);
}
async function css(path) {
  let value = await text(path);
  value = await replaceAsync(value, /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g, async match => isLocal(match[2]) ? `url("${await dataUri(match[2],dirname(path))}")` : match[0]);
  if (/@import\s/i.test(value)) throw new Error(`Inline CSS imports before bundling ${relative(root,path)}`);
  return value.replace(/<\/style/gi,'<\\/style');
}
async function script(path) {
  let value = await text(path);
  // Static asset literals in every controller, not only the original app closure.
  value = await replaceAsync(value, /(['"`])((?:\.\/)?assets\/[a-z0-9_./-]+\.(?:svg|png|jpe?g|webp|gif|woff2?))\1/gi,
    async match => `${match[1]}${await dataUri(match[2],root)}${match[1]}`);
  return value.replace(/<\/script/gi,'<\\/script');
}
async function bundle(entry) {
  const path = localPath(entry);
  let html = await text(path);
  html = await replaceAsync(html, /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, async match => {
    if (!isLocal(match[1])) throw new Error(`Remote CSS cannot be packaged offline: ${match[1]}`);
    return `<style>\n${await css(localPath(match[1],dirname(path)))}\n</style>`;
  });
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
  const inline = await Promise.all(scripts.map(match => {
    if(!isLocal(match[1])) throw new Error(`Remote script cannot be packaged offline: ${match[1]}`);
    return script(localPath(match[1],dirname(path)));
  }));
  for (const match of scripts) html = html.replace(match[0], '');
  html = await replaceAsync(html, /(<(?:img|source)\b[^>]*\bsrc=")([^"]+)(")/g, async match => isLocal(match[2]) ? `${match[1]}${await dataUri(match[2],dirname(path))}${match[3]}` : match[0]);
  html = await replaceAsync(html, /(<link\b[^>]*href=")([^"\s]+\.(?:svg|png|ico))(")/g, async match => isLocal(match[2]) ? `${match[1]}${await dataUri(match[2],dirname(path))}${match[3]}` : match[0]);
  return html.replace('</body>', () => `<script>\n${inline.join('\n;\n')}\n</script>\n</body>`);
}
await mkdir(resolve(root,'dist'), {recursive:true});
for (const [source, output] of [
  ['experience.html','experience.html'],
  ['showcase.html','showcase.html'],
  ['index.html','journey-reference.html'],
  ['completion-preview.html','completion-preview.html'],
  ['concept-preview.html','concept-preview.html']
]) {
  await writeFile(resolve(root,'dist',output),await bundle(source));
}
// The default opens the connected mock experience; components have their own page.
await writeFile(resolve(root,'dist','index.html'),await readFile(resolve(root,'dist','experience.html')));
console.log('Built mock experience/default index, component notebook, and three reference entries in dist/.');
