const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const stage = $('canvas-stage');
const overlay = $('ocr-layer');
const dictionary = window.LEGIBLELENS_DICTIONARY || [];
const inflections = window.LEGIBLELENS_INFLECTIONS || {};

let source = null;
let crop = null;
let selecting = false;
let start = null;
let worker = null;
let busy = false;
let runId = 0;
let ocrLines = [];
let selectMode = 'single';
let overlayVisible = true;
const selected = new Map();
const screenCapture = globalThis.Capacitor?.Plugins?.ScreenCapture;

const status = text => { $('status').textContent = text; };

function counts() {
  const text = $('result').value;
  $('count').textContent = text.length + ' characters';
  $('copy').disabled = $('save').disabled = !text.trim();
}

$('result').addEventListener('input', counts);

function draw() {
  if (!source) return;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (crop) {
    ctx.strokeStyle = '#78a13e';
    ctx.fillStyle = '#d8f19b33';
    ctx.lineWidth = Math.max(3, canvas.width / 220);
    ctx.fillRect(crop.x, crop.y, crop.w, crop.h);
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
  }
}

function resetReader() {
  ocrLines = [];
  selected.clear();
  overlay.replaceChildren();
  $('reader-tools').hidden = true;
  $('lookup-popup').hidden = true;
}

function setImage(image, readyMessage = 'Image ready. Draw around a bubble or scan the full screen.') {
  const ratio = Math.min(1, 2400 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  source = document.createElement('canvas');
  source.width = canvas.width;
  source.height = canvas.height;
  source.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  crop = null;
  selecting = false;
  start = null;
  stage.classList.remove('cropping');
  $('reset').hidden = true;
  $('crop').textContent = 'Draw scan area';
  $('upload').hidden = true;
  $('preview').hidden = false;
  $('scan').disabled = false;
  $('result').value = '';
  $('image-hint').textContent = 'Scan the full screen, or draw around one bubble for better accuracy.';
  resetReader();
  counts();
  draw();
  status(readyMessage);
}

async function loadImageUrl(url, message) {
  const image = new Image();
  image.src = url;
  await image.decode();
  setImage(image, message);
}

$('image').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file || busy) return;
  if (file.size > 25 * 1024 * 1024) {
    status('Please choose an image smaller than 25 MB.');
    event.target.value = '';
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    await loadImageUrl(url);
  } catch {
    status('This image could not be opened. Try a JPG, PNG, or WEBP.');
  } finally {
    URL.revokeObjectURL(url);
    event.target.value = '';
  }
});

$('sample').onclick = () => {
  const sample = document.createElement('canvas');
  sample.width = 1200;
  sample.height = 520;
  const c = sample.getContext('2d');
  c.fillStyle = '#fffdf7';
  c.fillRect(0, 0, sample.width, sample.height);
  c.fillStyle = '#18221b';
  c.font = 'bold 72px "Yu Gothic", "Noto Sans JP", sans-serif';
  c.fillText('今日は学校へ行きます。', 70, 190);
  c.font = '64px "Yu Gothic", "Noto Sans JP", sans-serif';
  c.fillText('猫が好きです。', 70, 330);
  c.font = '28px "Yu Gothic", "Noto Sans JP", sans-serif';
  c.fillStyle = '#60705e';
  c.fillText('文字をタップしてください', 72, 415);
  $('language').value = 'jpn';
  setImage(sample, 'Japanese demo ready. Press Scan text, then tap the green words.');
};

$('capture-screen').onclick = async () => {
  if (!screenCapture?.start) {
    status('Phone screen capture is available in the Android APK only.');
    return;
  }
  try {
    await screenCapture.start();
    status('Switch to the Japanese screen, then tap Freeze current screen in the notification.');
  } catch (error) {
    status('Screen capture was not started. ' + (error.message || 'Permission was cancelled.'));
  }
};

$('crop').onclick = () => {
  selecting = !selecting;
  stage.classList.toggle('cropping', selecting);
  $('crop').textContent = selecting ? 'Finish drawing' : 'Draw scan area';
  $('image-hint').textContent = selecting
    ? 'Drag across one speech bubble. Tap Finish drawing when the box is correct.'
    : 'Press Scan text to recognize the selected area.';
};

function point(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height))
  };
}

stage.onpointerdown = event => {
  if (!selecting || busy) return;
  start = point(event);
  stage.setPointerCapture(event.pointerId);
};

stage.onpointermove = event => {
  if (!start) return;
  const end = point(event);
  crop = {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(start.x - end.x),
    h: Math.abs(start.y - end.y)
  };
  draw();
};

function endSelection() {
  if (!start) return;
  start = null;
  if (!crop || crop.w < 12 || crop.h < 12) crop = null;
  $('reset').hidden = !crop;
  draw();
}

stage.onpointerup = endSelection;
stage.onpointercancel = endSelection;

$('reset').onclick = () => {
  crop = null;
  $('reset').hidden = true;
  draw();
  status('Full screen selected.');
};

function setBusy(value) {
  busy = value;
  for (const id of ['image', 'language', 'scan', 'sample', 'crop', 'reset']) {
    const element = $(id);
    if (element) element.disabled = value;
  }
  $('cancel').hidden = !value;
  $('progress').hidden = !value;
}

$('cancel').onclick = async () => {
  runId++;
  const active = worker;
  worker = null;
  setBusy(false);
  status('Scan cancelled. Your image is ready to try again.');
  if (active) await active.terminate();
};

function extractLines(blocks, offsetX, offsetY, fallbackText, fallbackBox) {
  const lines = [];
  for (const block of blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const text = (line.text || '').trim();
        const box = line.bbox;
        if (!text || !box) continue;
        lines.push({
          text,
          box: {
            x0: box.x0 + offsetX,
            y0: box.y0 + offsetY,
            x1: box.x1 + offsetX,
            y1: box.y1 + offsetY
          }
        });
      }
    }
  }
  if (!lines.length && fallbackText.trim()) {
    lines.push({ text: fallbackText.trim(), box: fallbackBox });
  }
  return lines;
}

function segment(text) {
  try {
    return [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)].map(item => ({
      text: item.segment,
      selectable: item.isWordLike !== false && /[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(item.segment)
    }));
  } catch {
    return [...text].map(char => ({ text: char, selectable: !/\s|[。、！？「」『』（）]/.test(char) }));
  }
}

function renderOverlay() {
  overlay.replaceChildren();
  selected.clear();
  $('lookup-popup').hidden = true;
  const vertical = $('language').value === 'jpn_vert';
  ocrLines.forEach((line, lineIndex) => {
    const element = document.createElement('div');
    element.className = 'ocr-line' + (vertical ? ' vertical' : '');
    const width = Math.max(18, line.box.x1 - line.box.x0);
    const height = Math.max(18, line.box.y1 - line.box.y0);
    element.style.left = (line.box.x0 / canvas.width * 100) + '%';
    element.style.top = (line.box.y0 / canvas.height * 100) + '%';
    element.style.width = (width / canvas.width * 100) + '%';
    element.style.height = (height / canvas.height * 100) + '%';
    const screenScale = stage.clientWidth / canvas.width;
    element.style.fontSize = Math.max(12, Math.min(30, (vertical ? width : height) * screenScale * .68)) + 'px';

    segment(line.text).forEach((token, tokenIndex) => {
      const span = document.createElement('span');
      span.className = 'ocr-token' + (token.selectable ? '' : ' punctuation');
      const result = token.selectable ? dictionaryResult(token.text) : null;
      span.append(token.text);
      if (result?.entry?.reading && result.entry.reading !== token.text) {
        const reading = document.createElement('rt');
        reading.textContent = result.entry.reading;
        span.classList.add('has-furigana');
        span.append(reading);
      }
      span.dataset.key = lineIndex + ':' + tokenIndex;
      span.dataset.order = lineIndex * 1000 + tokenIndex;
      if (token.selectable) {
        span.tabIndex = 0;
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', 'Look up ' + token.text);
        span.onclick = () => chooseToken(span, token.text);
        span.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            chooseToken(span, token.text);
          }
        };
      }
      element.append(span);
    });
    overlay.append(element);
  });
  overlay.classList.toggle('hidden-overlay', !overlayVisible);
  $('reader-tools').hidden = !ocrLines.length;
}

function normalize(text) {
  return text.replace(/[\s。、！？!?「」『』（）()]/g, '');
}

function dictionaryResult(text) {
  const clean = normalize(text);
  let entry = dictionary.find(item => item.term === clean);
  let base = clean;
  if (!entry && inflections[clean]) {
    base = inflections[clean];
    entry = dictionary.find(item => item.term === base);
  }
  if (entry) return { entry, base, exact: base === clean };

  const pieces = [...selected.values()]
    .sort((a, b) => a.order - b.order)
    .map(item => {
      const token = normalize(item.text);
      const tokenBase = inflections[token] || token;
      return dictionary.find(row => row.term === tokenBase);
    })
    .filter(Boolean);
  if (pieces.length) {
    return {
      entry: {
        term: clean,
        reading: pieces.map(item => item.reading).join(' · '),
        mongolian: pieces.map(item => item.term + ': ' + item.mongolian).join('\n'),
        partOfSpeech: 'multiple words'
      },
      base: clean,
      exact: true
    };
  }
  return null;
}

function selectedText() {
  const items = [...selected.values()].sort((a, b) => a.order - b.order);
  const separator = items.some(item => /[一-龯ぁ-んァ-ヶ]/.test(item.text)) ? '' : ' ';
  return items.map(item => item.text).join(separator);
}

function showLookup() {
  const text = selectedText();
  if (!text) {
    $('lookup-popup').hidden = true;
    return;
  }
  const result = dictionaryResult(text);
  $('lookup-title').textContent = text;
  $('lookup-reading').textContent = result ? result.entry.reading : 'Reading not found in the starter dictionary';
  $('lookup-meaning').textContent = result ? result.entry.mongolian : 'Офлайн тольд одоогоор бүртгэл алга.';
  $('lookup-note').textContent = result
    ? (result.exact ? result.entry.partOfSpeech : 'Dictionary form: ' + result.base + ' · ' + result.entry.partOfSpeech)
    : 'Use Translate online for a full Japanese → Mongolian translation.';
  $('online-translate').href = 'https://translate.google.com/?sl=ja&tl=mn&text=' + encodeURIComponent(text) + '&op=translate';
  $('lookup-popup').hidden = false;
}

function chooseToken(element, text) {
  const key = element.dataset.key;
  if (selectMode === 'single') {
    selected.clear();
    overlay.querySelectorAll('.ocr-token.selected').forEach(item => item.classList.remove('selected'));
  }
  if (selectMode === 'multi' && selected.has(key)) {
    selected.delete(key);
    element.classList.remove('selected');
  } else {
    selected.set(key, { text, order: Number(element.dataset.order) });
    element.classList.add('selected');
  }
  showLookup();
}

function setMode(mode) {
  selectMode = mode;
  $('single-mode').classList.toggle('active', mode === 'single');
  $('multi-mode').classList.toggle('active', mode === 'multi');
  $('single-mode').setAttribute('aria-pressed', String(mode === 'single'));
  $('multi-mode').setAttribute('aria-pressed', String(mode === 'multi'));
  status(mode === 'single' ? 'One word mode: tap any green word.' : 'Multiple mode: tap several green words to combine them.');
}

$('single-mode').onclick = () => setMode('single');
$('multi-mode').onclick = () => setMode('multi');
$('clear-selection').onclick = () => {
  selected.clear();
  overlay.querySelectorAll('.selected').forEach(item => item.classList.remove('selected'));
  $('lookup-popup').hidden = true;
  status('Selection cleared.');
};
$('toggle-overlay').onclick = () => {
  overlayVisible = !overlayVisible;
  overlay.classList.toggle('hidden-overlay', !overlayVisible);
  $('toggle-overlay').classList.toggle('active', overlayVisible);
  $('toggle-overlay').textContent = overlayVisible ? 'Overlay on' : 'Overlay off';
  $('toggle-overlay').setAttribute('aria-pressed', String(overlayVisible));
};
$('close-popup').onclick = () => { $('lookup-popup').hidden = true; };

$('scan').onclick = async () => {
  if (!source || busy) return;
  const id = ++runId;
  setBusy(true);
  resetReader();
  $('progress').value = 0;
  status('Loading the OCR engine…');
  let localWorker;
  const current = () => id === runId;
  try {
    localWorker = await Tesseract.createWorker($('language').value, 1, {
      workerPath: '/vendor/worker.min.js',
      corePath: '/core',
      langPath: '/ocr',
      logger: message => {
        if (!current()) return;
        status(message.status === 'recognizing text'
          ? 'Scanning the image… ' + Math.round(message.progress * 100) + '%'
          : 'Preparing OCR: ' + message.status + '…');
        $('progress').value = message.progress || 0;
      }
    });
    if (!current()) {
      await localWorker.terminate();
      return;
    }
    worker = localWorker;
    await localWorker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      preserve_interword_spaces: '1'
    });

    let input = source;
    let offsetX = 0;
    let offsetY = 0;
    const target = crop
      ? { x0: crop.x, y0: crop.y, x1: crop.x + crop.w, y1: crop.y + crop.h }
      : { x0: 0, y0: 0, x1: canvas.width, y1: canvas.height };
    if (crop) {
      input = document.createElement('canvas');
      input.width = Math.max(1, Math.round(crop.w));
      input.height = Math.max(1, Math.round(crop.h));
      input.getContext('2d').drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, input.width, input.height);
      offsetX = crop.x;
      offsetY = crop.y;
    }
    const { data } = await localWorker.recognize(input, {}, { text: true, blocks: true });
    if (current()) {
      const text = (data.text || '').trim();
      $('result').value = text;
      counts();
      ocrLines = extractLines(data.blocks, offsetX, offsetY, text, target);
      renderOverlay();
      status(text
        ? 'Scan complete. Tap the green text on the image for the popup dictionary.'
        : 'No text found. Draw a smaller box around clear Japanese text and try again.');
      $('reader-help').hidden = Boolean(text);
    }
  } catch (error) {
    if (current()) status('Scan failed. Try a smaller, clearer region. ' + (error.message || ''));
  } finally {
    if (localWorker) await localWorker.terminate().catch(() => {});
    if (current()) {
      worker = null;
      setBusy(false);
    }
  }
};

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const temporary = document.createElement('textarea');
  temporary.value = text;
  temporary.style.position = 'fixed';
  temporary.style.opacity = '0';
  document.body.append(temporary);
  temporary.select();
  if (!document.execCommand('copy')) throw new Error('manual');
  temporary.remove();
}

$('copy').onclick = async () => {
  try {
    await copyText($('result').value);
    status('OCR text copied.');
  } catch {
    $('result').focus();
    $('result').select();
    status('Text selected. Long-press it and choose Copy.');
  }
};

$('copy-selection').onclick = async () => {
  try {
    await copyText(selectedText());
    status('Selected Japanese copied.');
  } catch {
    status('Could not copy automatically. Select the text in the OCR transcript.');
  }
};

$('save').onclick = () => {
  const url = URL.createObjectURL(new Blob([$('result').value], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'legiblelens-japanese.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Text file downloaded.');
};

new ResizeObserver(() => {
  if (ocrLines.length) renderOverlay();
}).observe(stage);

async function loadExtensionCapture() {
  if (!new URLSearchParams(location.search).has('capture')) return;
  if (!globalThis.chrome?.storage?.local) {
    status('Screen capture is unavailable. Choose a screenshot instead.');
    return;
  }
  try {
    const stored = await chrome.storage.local.get('pendingCapture');
    const capture = stored.pendingCapture;
    if (!capture?.dataUrl) throw new Error('missing');
    await loadImageUrl(capture.dataUrl, 'Visible browser tab captured. Draw around manga text or press Scan text.');
    await chrome.storage.local.remove('pendingCapture');
  } catch {
    status('The browser screen could not be captured. Choose a screenshot instead.');
  }
}

loadExtensionCapture();

window.addEventListener('screenCaptured', async event => {
  const dataUrl = event.detail?.dataUrl;
  if (!dataUrl) return;
  await loadImageUrl(dataUrl, 'Screen frozen. OCR is starting...');
  $('scan').click();
});
