import { mkdir, writeFile, access } from 'node:fs/promises';
const directory = new URL('../public/ocr/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const language of ['eng','jpn','jpn_vert']) {
  const target = new URL(language + '.traineddata.gz', directory);
  try { await access(target); continue; } catch {}
  const response = await fetch('https://tessdata.projectnaptha.com/4.0.0/' + language + '.traineddata.gz');
  if (!response.ok) throw new Error('Language download failed: ' + response.status);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log('Downloaded OCR model:', language);
}
