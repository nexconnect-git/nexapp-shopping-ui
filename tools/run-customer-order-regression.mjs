import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const directory = resolve('node_modules/.cache/customer-order-regression');
await mkdir(directory, { recursive: true });
const output = resolve(directory, 'test.mjs');
try {
  await build({ entryPoints: ['tools/customer-order-regression.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', packages: 'external',
    tsconfig: 'tsconfig.json', logLevel: 'warning' });
  await import(pathToFileURL(output).href);
} finally {
  await rm(output, { force: true });
}
