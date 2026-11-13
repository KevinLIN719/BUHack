import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { pdfFixture } = require('../server/tests/pdf-fixture.ts');
const output = new URL('../.data/demo-contract.pdf', import.meta.url);
await mkdir(new URL('../.data/', import.meta.url), {recursive:true});
await writeFile(output, pdfFixture([
  'DEMO POLICY - fictional test material. Delay exceeding 6 hours.',
  'DEMO POLICY - Carrier proof is required. Maximum benefit 1000.',
]));
console.log(`Fictional upload sample: ${fileURLToPath(output)}`);
