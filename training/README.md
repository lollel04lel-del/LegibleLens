# Model and dataset work

This is the main academic work area for LegibleLens.

Planned reproducible stages:

1. Record every dataset source, license, language, image type, and permitted use in a dataset card.
2. Convert annotations to text blocks with normalized boxes, orientation, transcription, and reading order.
3. Split by manga volume/source so pages from one work cannot leak between training and evaluation.
4. Measure a Tesseract baseline.
5. Fine-tune a manga-trained Japanese recognizer.
6. Evaluate character error rate, exact-bubble accuracy, inference time, and vertical/horizontal subsets.
7. Add Japanese-to-Mongolian evaluation as a separate stage using corrected Japanese references.

Model weights, copyrighted manga pages, and private datasets must not be committed. Small test fixtures must have documented permission or be generated specifically for the project.
