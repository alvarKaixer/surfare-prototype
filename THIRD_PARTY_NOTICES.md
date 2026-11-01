# Third-party components

Preserve upstream licenses. Collected package notices are under `public/licenses/`; additional licenses are distributed with the installed npm packages.

- React / React DOM: MIT — https://github.com/facebook/react
- Vite, Tailwind CSS, tldts, Workbox: MIT (see respective distributions)
- Tesseract.js, jsQR: Apache-2.0
- Lucide: ISC
- Fraunces and Lexend fonts: SIL Open Font License 1.1 (see font notices under `public/licenses`)
- Surfare / Surfy artwork: supplied through the user's Surfare proposal site, reused as project branding. This repository does not grant a new open-source license to that artwork or the user's application code.

Google Safe Browsing usage is subject to Google's API terms, noncommercial-use conditions, quotas and attribution requirements.

The offline SMS model is trained on the UCI SMS Spam Collection (Almeida & Hidalgo, 2011, CC BY 4.0) and Alexander/Yissuh's Filipino SMS corpus (BSD-3-Clause). Data attribution and the preserved BSD license are distributed in `public/licenses/sms-model-attribution.txt` and `public/licenses/filipino-sms-BSD-3-Clause.txt`. Preparation, evaluation and modifications are documented in `docs/DETECTION.md`. The browser receives model coefficients, not complete training messages.
