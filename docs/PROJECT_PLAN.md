# LegibleLens project plan

## Project definition

LegibleLens is primarily a Japanese manga OCR and Japanese-to-Mongolian translation system. The web interface, Opera GX extension, and Android APK are clients used to demonstrate and distribute the core OCR system.

## Final processing flow

```text
Manga image
  -> detect Japanese text regions
  -> recognize vertical/horizontal Japanese
  -> reconstruct bubble reading order
  -> correct/edit OCR text
  -> translate Japanese sentence to Mongolian
  -> tap a word for reading and Mongolian meaning
  -> display/export translated result
```

## Repository targets

- `public/`: shared phone/desktop web interface.
- `services/ocr-api/`: future trained OCR inference service and Japanese-to-Mongolian translation adapter.
- `platforms/extension/`: Opera GX/Chromium Manifest V3 packaging.
- `android/`: Capacitor Android application generated from the shared interface.
- `docs/`: research, dataset decisions, experiments, metrics, and reports.
- `.github/workflows/build.yml`: reproducible GitHub builds for APK and extension ZIP.

## Work phases

### Phase 1 — Reproducible application shell

- Keep one shared interface for browser and APK.
- Build a Manifest V3 Opera GX extension package.
- Build an Android debug APK through Capacitor.
- Produce both artifacts from GitHub Actions.

Success: a GitHub workflow run provides `legiblelens-debug-apk` and `legiblelens-opera-extension` downloads.

### Phase 2 — Dataset and baseline

- Define permitted Japanese manga/printed-text datasets and record their licenses.
- Store annotations as image, text bounding boxes, orientation, transcription, and reading order.
- Make train/validation/test splits with no page or volume leakage.
- Establish Tesseract.js as a simple baseline only.
- Define character error rate (CER), exact bubble accuracy, detection precision/recall, inference time, and translation quality evaluation.

Success: the dataset card and baseline evaluation can be reproduced from scripts in the repository.

### Phase 3 — Manga OCR model

- Start from a manga-trained recognizer rather than training from zero.
- Fine-tune recognition on legally usable vertical and horizontal Japanese samples.
- Add text-region detection for full pages.
- Return structured blocks: text, normalized bounding box, orientation, confidence, and reading order.
- Export an inference format suitable for the local service; investigate ONNX/mobile export after accuracy is acceptable.

Success: the fine-tuned model beats the Tesseract baseline on held-out manga-style samples.

### Phase 4 — Japanese-to-Mongolian

- Preserve the Japanese OCR text separately from the translation.
- Add sentence-level Japanese-to-Mongolian translation through a replaceable adapter.
- Build a small human-reviewed evaluation set.
- Add word lookup with reading, base form, and Mongolian meaning.
- Clearly mark OCR corrections and machine translations in the interface.

Success: a user can scan one speech bubble and view editable Japanese plus a Mongolian translation.

### Phase 5 — Image overlay and Yomitan-style interaction

- Place recognized blocks over the original image using normalized coordinates.
- Keep each bubble as continuous selectable text.
- Tap a word to show a dictionary popup on Android Chrome/APK.
- Confirm that desktop Yomitan can scan the selectable overlay.

Success: lookup remains aligned after zoom, rotation, and resizing.

### Phase 6 — Platform features

- Opera GX: user-triggered region capture and overlay injection with minimal permissions.
- Android: gallery, camera, and share-to-LegibleLens input.
- Add offline caching where model size permits.
- Add export to text/image and optional Anki support.

### Phase 7 — Release and report

- Automated tests and benchmark report.
- Signed release APK or Android App Bundle after a signing key is created and safely stored.
- Versioned Opera extension ZIP.
- Installation guide, privacy statement, model card, dataset card, and class presentation.

## Scope rules

- The OCR model and evaluation are the main academic contribution.
- The extension and APK share the application code and do not become separate projects.
- The first APK is a debug APK. Public release signing comes later.
- Existing models may be fine-tuned; training a competitive manga OCR and translation model from scratch is outside the first deliverable.
- Japanese OCR and Mongolian translation are evaluated separately so translation mistakes are not confused with OCR mistakes.

## Current state

- Working browser prototype with image upload, touch crop, Tesseract English/Japanese recognition, editing, copy, and download.
- Yomitan/Mokuro architecture research completed.
- Shared build, Capacitor configuration, extension packaging, and GitHub workflow foundation added.
- Manga-trained OCR, Japanese-to-Mongolian translation, overlay lookup, full extension capture, and release signing are not implemented yet.
