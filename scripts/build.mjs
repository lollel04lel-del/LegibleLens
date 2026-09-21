import { cp, copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const tesseractRoot = path.dirname(require.resolve('tesseract.js/package.json'));
const tesseractRequire = createRequire(path.join(tesseractRoot, 'package.json'));
const coreRoot = path.dirname(tesseractRequire.resolve('tesseract.js-core/package.json'));
const web = path.join(root, 'dist', 'web');
const extension = path.join(root, 'dist', 'extension');

await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(web, 'vendor'), { recursive: true });
await mkdir(path.join(web, 'core'), { recursive: true });
await cp(path.join(root, 'public'), web, { recursive: true });

for (const file of ['tesseract.min.js', 'worker.min.js']) {
  await copyFile(path.join(tesseractRoot, 'dist', file), path.join(web, 'vendor', file));
}
for (const file of await readdir(coreRoot)) {
  if (/^tesseract-core.*\.(?:js|wasm)$/.test(file)) {
    await copyFile(path.join(coreRoot, file), path.join(web, 'core', file));
  }
}

await cp(web, extension, { recursive: true });
await cp(path.join(root, 'platforms', 'extension'), extension, { recursive: true });
console.log('Built dist/web and dist/extension');
