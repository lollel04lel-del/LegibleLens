# LegibleLens: Yomitan-style manga OCR research

Research date: 2026-09-21

## The important correction

Yomitan is not an OCR engine. It is a popup dictionary that scans selectable text already present in a webpage. Its normal flow is: the user points at or taps a word, Yomitan searches from that character position, deinflects the Japanese word, searches installed dictionaries, and shows definitions, readings, audio, pitch-accent data, and optional Anki actions.

For a manga image, a separate OCR system must create text before Yomitan can scan it. The closest established design is Mokuro:

1. Detect the text regions on the manga page.
2. Recognize each text region with a Japanese manga OCR model.
3. Save each block's text, bounding box, orientation, and reading order.
4. Render selectable HTML text over the original image.
5. Let Yomitan scan that HTML on desktop, or let LegibleLens show its own dictionary popup on unsupported browsers and inside the APK.

Sources:

- [Yomitan getting started](https://yomitan.wiki/getting-started/) says Yomitan works where selectable text exists and describes hover/tap lookup.
- [Mokuro](https://github.com/kha-white/mokuro) uses comic-text-detector plus manga-ocr and generates selectable browser text for popup dictionaries.
- [Manga OCR](https://github.com/kha-white/manga-ocr) is trained for Japanese manga, including vertical and horizontal writing, furigana, image backgrounds, varied fonts, and low-quality scans.

## Platform reality

| Target | How lookup should work |
| --- | --- |
| Opera GX / desktop Chromium | LegibleLens adds a selectable OCR overlay. Installed Yomitan can scan it. LegibleLens may also offer a built-in popup for users without Yomitan. |
| Android Firefox, Edge, or Elixir | A selectable overlay can work with the Yomitan extension, subject to the browser's extension behavior. On mobile, Yomitan opens from a direct tap. |
| Android Chrome | Yomitan is not supported. LegibleLens must include its own word segmentation, deinflection, dictionary search, and popup UI. |
| Android APK | The APK must include the same built-in lookup path as Android Chrome. It cannot depend on a browser extension. |

The Yomitan documentation explicitly says Android Firefox, Edge, and Elixir are supported, while Chrome mobile is not.

## Recommended product behavior

The user should be able to:

1. Open a manga image, screenshot, or webpage image.
2. Tap `Scan page`, or drag over one speech bubble for a faster scan.
3. See subtle outlines around recognized text blocks.
4. Tap any Japanese word directly on the image.
5. See a popup with the surface form, dictionary form, reading, meaning, part of speech, and sentence context.
6. Correct bad OCR without losing the text block's position.
7. Copy the word or sentence, and later create an Anki card.

The output should remain continuous text within each speech bubble. Splitting every Japanese character into an unrelated HTML element makes compound-word lookup and sentence context unreliable.

## Recommended data model

Each detected block should preserve spatial and linguistic information:

```json
{
  "id": "block-12",
  "text": "今日は学校へ行きます",
  "box": { "x": 0.61, "y": 0.14, "width": 0.12, "height": 0.31 },
  "orientation": "vertical",
  "readingOrder": 4,
  "confidence": 0.92
}
```

Normalized coordinates let the same overlay scale on a phone, desktop browser, and APK.

## OCR engine decision

### Current browser prototype

The current Tesseract.js prototype is useful for proving image selection, progress, cropping, and editable output. It should remain as a lightweight fallback for clear printed English and simple horizontal Japanese.

### Japanese manga mode

Use a two-stage pipeline:

- Text detection: locate speech bubbles and text blocks, determine vertical/horizontal orientation, and return bounding boxes.
- Recognition: pass each crop to a Japanese manga model such as manga-ocr.

This is the same overall structure used by Mokuro. Manga-ocr can process multiline bubbles and is designed for vertical Japanese, furigana, unusual fonts, text over art, and degraded images. Its model is about 400 MB, so loading it directly in a phone browser is not a good first MVP.

For the class-project MVP, run the manga OCR service locally on the development computer and let the browser/extension send only the selected crop over the local network. A later APK can use an ONNX/mobile model for fully offline recognition.

## Dictionary behavior

The built-in popup should follow Yomitan's user-facing behavior rather than copying its code:

- Search the longest matching word beginning at the tapped character.
- Generate possible dictionary forms from conjugated Japanese.
- Search imported dictionary entries.
- Rank exact and common matches first.
- Show reading, definitions, part of speech, pitch accent when available, and the full OCR sentence.
- Keep the tapped word highlighted while the popup is open.

Yomitan's public dictionary format stores term entries, readings, definitions, tags, deinflection rule identifiers, scores, and metadata in JSON banks. Supporting import of Yomitan-format ZIP files later would let users reuse their dictionaries. The format is documented in [Yomitan's dictionary authoring guide](https://github.com/yomidevs/yomitan/blob/master/docs/making-yomitan-dictionaries.md).

For an early demonstration, use a properly licensed Japanese-English dictionary subset rather than attempting full Yomitan-compatible imports immediately.

## Architecture

```text
Image / webpage screenshot
          |
          v
Text-block detector
          |
          v
Japanese manga recognizer
          |
          v
OCR blocks: text + box + orientation + order
          |
          +--> selectable overlay --> installed Yomitan (desktop / supported Android browser)
          |
          +--> tokenizer + deinflector + dictionary --> LegibleLens popup (Chrome / APK)
```

Recommended components:

- Shared web UI: image viewer, region selection, OCR overlay, text correction, popup UI.
- Local development OCR service: accepts an image crop and returns structured OCR blocks.
- Browser extension adapter: captures the current tab/selected image and injects the overlay.
- Android wrapper: packages the shared UI and adds camera/gallery/share support.
- Dictionary storage: IndexedDB in browsers; the same data can later move to SQLite in the APK if required.

## Privacy and permissions

Default to local OCR. When a local development server is used, communicate only over the user's local network and state clearly that selected image crops are sent to the computer. A future cloud OCR option would need explicit user consent and a privacy policy.

The extension should request only the minimum permissions needed for capture and overlay injection. Yomitan itself uses broad page access because it injects scanning and popup scripts across webpages; LegibleLens should initially use user-triggered access where feasible.

## Licensing notes

- Yomitan is GPL-3.0. Copying or incorporating its code would bring GPL obligations. Implementing compatible behavior and documented data formats independently is cleaner for a class project.
- Mokuro and comic-text-detector are GPL-3.0. Using or distributing their code requires respecting that license.
- The manga-ocr model is published under Apache-2.0. Verify the exact package and model licenses again before distribution.
- Dictionaries have separate licenses. Do not bundle a dictionary until its redistribution terms are verified.

## Revised MVP

The next meaningful milestone is not a general OCR textarea. It is this full Japanese reading loop:

1. Load one manga image.
2. Select one speech bubble.
3. Recognize vertical or horizontal Japanese with a manga-trained OCR engine.
4. Draw the recognized text over the original bubble.
5. Tap a word and show its reading and English meaning.
6. Correct OCR and scan again.

After that works, expand from manual bubble selection to full-page text detection, then package the same experience as an Opera GX extension and Android APK.

## Acceptance checks

- Clear vertical manga bubble can be recognized and retains correct Japanese reading order.
- Furigana does not replace or corrupt the main word in common cases.
- Tapping inside an OCR block selects the intended word.
- Inflected words such as 食べました resolve to their dictionary form 食べる.
- Overlay remains aligned after zooming, rotating a phone, or resizing the browser.
- A user can edit a wrong character and immediately repeat lookup.
- Desktop overlay is selectable by Yomitan.
- Android Chrome lookup works without Yomitan installed.
