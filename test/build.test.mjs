import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { route } from '../server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('build creates standalone web OCR assets', async () => {
  for (const file of [
    'dist/web/index.html',
    'dist/web/vendor/tesseract.min.js',
    'dist/web/vendor/worker.min.js',
    'dist/web/ocr/eng.traineddata.gz',
    'dist/web/ocr/jpn.traineddata.gz'
  ]) await access(path.join(root, file));
});

test('extension is Manifest V3 and opens the shared app', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'dist/extension/manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(manifest.host_permissions, undefined);
  assert.match(await readFile(path.join(root, 'dist/extension/background.js'), 'utf8'), /index\.html/);
});

test('server routes only to generated web files', () => {
  const webRoot = path.join(root, 'dist', 'web');
  for (const url of ['/', '/app.js', '/core/tesseract-core.wasm']) {
    const target = route(url);
    assert.ok(target.startsWith(`${webRoot}${path.sep}`));
  }
});

test('Capacitor Android project and app identity are configured', async () => {
  await access(path.join(root, 'android/app/src/main/java/mn/legiblelens/app/MainActivity.java'));
  const config = JSON.parse(await readFile(path.join(root, 'capacitor.config.json'), 'utf8'));
  assert.equal(config.appId, 'mn.legiblelens.app');
});

test('OCR service contract keeps Japanese and Mongolian outputs separate', async () => {
  const schema = JSON.parse(await readFile(path.join(root, 'services/ocr-api/contracts/ocr-block.schema.json'), 'utf8'));
  assert.ok(schema.required.includes('text'));
  assert.equal(schema.properties.mongolianTranslation.type, 'string');
  assert.equal(schema.properties.box.properties.x.maximum, 1);
  assert.deepEqual(schema.properties.orientation.enum, ['horizontal', 'vertical', 'unknown']);
});
