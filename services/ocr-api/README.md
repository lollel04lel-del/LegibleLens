# LegibleLens OCR API

This directory will contain the main Japanese manga OCR and Japanese-to-Mongolian inference service.

The first implementation should expose:

- `GET /health`: model and service readiness.
- `POST /v1/ocr`: detect and recognize Japanese text blocks from an image.
- `POST /v1/translate`: translate corrected Japanese text into Mongolian.
- `POST /v1/process`: run OCR and translation while keeping both outputs separate.

The web, extension, and APK clients must consume the same structured OCR block contract in `contracts/ocr-block.schema.json`. During development the service may run on the user's computer. A later mobile model can implement the same contract inside the APK.

Do not commit model weights or manga datasets to Git. Store reproducible download/fine-tuning instructions, hashes, licenses, and evaluation results instead.
