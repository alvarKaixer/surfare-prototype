# Detection implementation and measured limits

> Archived report from the assessment policy before contextual AI was integrated. Scores and operating-limit statements below describe that earlier version. See [the current validation methodology](VALIDATION.md) and `.reports/validation/report.json` for current measurements. The historical 94.19% final-assessment score must not be presented as current full-app accuracy.

The checker now applies one assessment path to typed messages, entered links, image OCR text, and decoded QR content. It combines explicit safety/scam rules, a compact offline SMS classifier, registered-domain analysis, and optional Google Safe Browsing. Surfy Q&A is excluded.

The reported message `sendan moko ng pera ngayon o papatayin kita 095583723` is **High risk**. The detector highlights the threat and payment demand separately, explains physical harm and coercion, and gives personal-safety recommendations. A phone number alone is not a danger signal.

## What changed

- `lib/safety-signals.js`: English/Filipino/Taglish physical threats, intimidation, extortion and exposure threats; local negation handling, common obfuscation and harmless-context checks.
- `lib/detection.js`: shared scam rules and URL analysis, look-alike domains, unfamiliar real suffixes, defanged addresses, executable downloads, and cross-site redirect parameters. It never visits the submitted destination.
- `lib/sms-model.js`: browser-side inference using a locally trained word/bigram naive Bayes model. Learned spam evidence can raise a review signal but cannot downgrade explicit threats or double-count a rule into High risk.
- `lib/text-evidence.js`: maps normalized matching back to exact original text, including Unicode and zero-width characters. React renders text and buttons, never user-supplied HTML.
- `lib/content-assessment.js`: shared verdicts and uncertainty handling for all input paths. Unreliable OCR and unsupported QR data cannot receive a low-risk verdict merely because nothing matched.
- `app/components/Assessment.tsx`: clickable evidence, explanations, summary, a three-category risk bar, recommendations and separate online verification state. The meter is categorical, not a probability.

OCR still uses local Tesseract.js; QR decoding uses jsQR. The image tab now retries QR decoding at full resolution too. The full model and OCR resources are included in offline preparation. OpenCV is not used; image-quality checks use Canvas and local pixel calculations. No LLM API or additional remote content transmission was introduced.

## Recorded test results

See `detection-benchmark.json` for machine-readable results and source checksums; `model-training.json` records training and validation.

| Frozen test partition   | Cases | Displayed assessment accuracy | Spam recall | Unconfirmed |
| ----------------------- | ----: | ----------------------------: | ----------: | ----------: |
| Combined                |   860 |                        94.19% |      84.85% |          29 |
| UCI SMS Spam Collection |   783 |                        96.04% |      83.70% |          16 |
| Philippine SMS corpus   |    77 |                        75.32% |      87.50% |          13 |

Combined balanced accuracy is **90.36%**, precision **92.56%**, and false-positive rate **1.24%**. There are 112 flagged spam messages, 698 correctly low-risk legitimate messages, 9 false alarms, and 20 spam messages not flagged. Unconfirmed outputs count as incorrect; they are not silently dropped. The model alone scores 97.44% accuracy, but that is not the app's final verdict score.

The 90% target is exceeded on the combined public SMS benchmark only. It is **not established across all languages or content types**. The Philippine subset remains weaker, partly because unverified legitimate URLs correctly remain unconfirmed rather than being called safe. Its labels do not identify language per message, so it cannot establish separate Filipino or Taglish accuracy. No real-world violence corpus or independently labeled camera-photo/QR corpus was available in this task. Authored regression cases and synthetic OCR fixtures check behavior, not population accuracy.

Both public datasets label spam/ham, which differs from verified fraud or personal danger. Some unwanted promotions are labeled spam; some ordinary messages with risky-looking links are ham. The combined dataset is imbalanced toward ham. Always examine recall, balanced accuracy, false positives, abstentions, and source-specific results alongside overall accuracy. The 77-message Philippine test subset is small. Near-duplicates beyond the normalization scheme and source-specific biases may remain.

## Reproducing the model

Sources, retrieved 2026-11-01:

1. Almeida, T. & Hidalgo, J. (2011), [SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms+spam+collection), DOI [10.24432/C5CC84](https://doi.org/10.24432/C5CC84), CC BY 4.0. Download `https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip` to `.preview/datasets/uci.zip`.
2. Alexander / Yissuh, [Filipino-Spam-SMS-Detection-Model](https://github.com/Yissuh/Filipino-Spam-SMS-Detection-Model), BSD-3-Clause. Download `https://raw.githubusercontent.com/Yissuh/Filipino-Spam-SMS-Detection-Model/main/data-set.csv` to `.preview/datasets/filipino.csv`. The upstream repository's license is preserved in `public/licenses/filipino-sms-BSD-3-Clause.txt`.

Raw corpora stay in ignored development storage; the application bundles coefficients, not complete source messages. Compare downloaded SHA-256 hashes with the report before reproducing these numbers. No third-party model pickle or executable was loaded.

Run from the project root:

```text
python research/scripts/prepare-sms-data.py
node research/scripts/train-sms-model.mjs
node research/scripts/evaluate-detector.mjs --test
npm test
npm run build
node --test tests/ocr.integration.mjs
```

Preparation normalizes Unicode, masks URLs/numbers for grouping, removes repeated normalized templates and conflicting labels, then splits by a fixed SHA-256 bucket: 70% train, 15% validation, 15% test. The resulting counts are 3,917 / 873 / 860. The Philippine CSV contains mixed encoding; invalid UTF-8 bytes are replaced explicitly. No synthetic cases are mixed into model training or its benchmark.

Training uses unique unigram/bigram features, additive smoothing 0.5 and a minimum feature count of 2. Threshold selection maximizes validation F1 among candidates with at least 95% validation precision, when available. The test split was first evaluated after detector integration and was not used to adjust model parameters or rules. The validation result is development feedback, not an independent accuracy claim. Training and inference use the same feature implementation.

For a further accuracy iteration, obtain independently labeled contemporary Filipino/Taglish scam and violence messages, plus benign counterexamples. Keep a new untouched test partition, document consent/provenance, and evaluate each input path and language separately. Do not repeatedly tune against this recorded test split.

## Current operating limits

- Google Safe Browsing code is integrated, but the local server reports `configured: false`; a server-side `GOOGLE_SAFE_BROWSING_API_KEY` is needed for real online lookups.
- The classifier recognizes learned wording and explicit patterns. It does not provide general semantic understanding or verify factual claims or identity.
- OCR errors can obscure a threat. The English Latin-character model reads many Filipino words but needs review, especially for photographs.
- One QR per image is decoded. Payment, Wi-Fi, contact and location payloads are not authenticated.
- Links are structurally inspected and optionally reputation-checked; live redirect chains and remote page contents are not inspected.
- Safety recommendations are context-specific general guidance. The tool is not an emergency-response service.
