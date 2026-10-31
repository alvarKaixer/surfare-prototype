# PDF scope and implementation

Source: g(OAT)ed.pdf supplied in this conversation. The request excludes Surfy's guided assistant; the mascot remains decorative branding. No assistant/Q&A is implemented.

| PDF item | Working implementation | Boundary |
|---|---|---|
| Objective 1 / features 1–2: offline multi-content checks | Messages, URL patterns, image OCR and QR; Workbox app/model caching; readiness panel and explicit resource download | Initial download required; browser storage and private sign-in can affect reopening. Video remains future scope as stated in the solution. |
| Objective 2 / feature 3: online verification | Opt-in server-side Google Safe Browsing lookup for extracted URLs | Needs internet; no-match does not establish safety. |
| Objective 3: identify input type | Magic-byte validation for PNG/JPEG/WebP, image decoder validation, bounds; OCR + QR methods selected for images | Images max 10 MB/40 MP; one QR per image. |
| Objective 4: image text + embedded QR | Local Tesseract OCR, jsQR, shared message/URL checks, editable extraction | English Latin OCR model; confidence measures recognition, not scam likelihood. |
| Objectives 5–6 / feature 5: explain message threats | English/Filipino/Taglish contextual indicators; reward/urgency, secrets, impersonation domains, advance-fees, investment/job and remote-access patterns | Heuristics cannot verify identity, factual truth, or all scams. |
| Objective 7: links | URL API + tldts actual domains, userinfo/IDNs/IPs, shorteners and cross-host redirect parameters, Google reputation | Live arbitrary redirect chains are not followed. Structural redirect checks are explicit; remote page content is not inspected. |
| Objective 8: context-specific next steps | Guidance selected from detected signals, separate actions for credentials, prizes, upfront payments, personal details, remote access and URLs | General user guidance, not an incident-response service. |
| Objective 9 / feature 4: understandable results | Four result categories, separate Google status, plain explanation, timed stages, step-by-step flow, mobile scroll to results | Known-threat status remains distinct from safety guarantee. |
| Objective 10 / feature 7: privacy / secure files | On-device image/message handling; no app-side scan history, magic-byte validation, file/decoded-pixel limits; explicit full-URL transmission consent; secret server key | Google receives opted-in full URLs; provider/hosting infrastructure may have their own policies. |
| Objective 11 / feature 6: Surfy Q&A | Excluded at user's request | Mascot art only. |
| Objective 12: communicate uncertainty | Insufficient evidence for uncertain OCR/QR or unconfirmed URLs; visible online/unavailable/not-checked states; limitations | Results are screenings, never authenticity certification. |
| Feature 8: performance/usability evaluation | Separate Evaluation view: labeled JSON import, per-language precision/recall/false positives, per-case outcomes, local timing, OCR character error rate, manual function checklist, anonymous usability form, local JSON exports | Example set is synthetic and not independent research validation; human testing and held-out data must actually be collected. |
| Proposed camera/optics tool | Web Camera + Canvas + OpenCV preflight and live hints for brightness, blur and bright-area glare proxy; contrast preprocessing | Optical quality heuristics may flag white paper or miss localized glare. |

## Demonstrated checks

- 44 automated tests cover rules, unavailable-provider behavior, result fusion, file signatures and size bounds, evaluation metric math, import validation, OCR edit-distance calculation and context-specific guidance, plus both hosting adapters.
- Previously verified real deployed Google lookup: neutral example.com (no match), Google test phishing (SOCIAL_ENGINEERING), Google test malware (MALWARE). These exercise connectivity and result mapping, not real-world accuracy.
- Browser checks include preview-before-scan, editable OCR, QR decoding, separate Google states and evaluation controls.
