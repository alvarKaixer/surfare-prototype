# Surfare

Surfare checks messages, links, image text and QR codes for threats and suspicious requests. Local detection runs first, with contextual AI as a fallback when no warning matches. Google Safe Browsing adds link reputation. A separate image-origin check reads metadata first, with optional visual review.

Built with React, TypeScript and Vite. Server adapters support Vercel and Cloudflare Workers.

## Features

- Local warning patterns and an offline SMS model, with AI backup for unmatched English, Filipino and Taglish messages. Free-only OpenRouter routing and optional Gemini support.
- Link reputation through Google Safe Browsing, without opening submitted destinations.
- Local OCR and QR decoding, including image preview, crop, rotation and editable extracted text.
- Metadata-first AI image checks, with optional visual review when no explicit marker is found. Missing provenance never proves authenticity; evidence confidence is not a calibrated probability.
- Offline local checks and prepared OCR resources; responsive UI with reduced-motion support.

The research/validation screens are hidden from the shipped app. Research code and methodology remain available under [`research/`](research/README.md) and [`docs/VALIDATION.md`](docs/VALIDATION.md).

## Run locally

Requires **Node.js 22.13 or newer** and npm. The repository pins Node 22 in `.nvmrc`.

```bash
npm ci
```

For a fresh checkout, create `.dev.vars` from [`.dev.vars.example`](.dev.vars.example). Keep an existing `.dev.vars` intact. Add your server keys to the local file, then run:

```bash
npm run dev
```

Open **http://localhost:8787**. This command builds the client and starts its local Worker API. For UI hot reload, keep it running and start `npm run dev:ui` in another terminal. Restart the Worker after changing keys.

Configured AI backup and reputation services are enabled by default. Content is sent only after **Check** is pressed. A local warning skips AI; unmatched messages use AI backup. **Options & privacy** can disable either service. The app also runs without provider keys, with unavailable services clearly identified.

## Commands

| Command                 | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `npm run dev`           | Build and run the complete app locally                                     |
| `npm run dev:ui`        | Vite hot reload; proxies `/api` to the local Worker                        |
| `npm test`              | Run code regression tests with mocked external services                    |
| `npm run check`         | Formatting, regression tests and a guarded production build                |
| `npm run build`         | Check secrets, typecheck, build client/OCR/offline assets and audit output |
| `npm run preview`       | Serve an existing build with the local Worker                              |
| `npm run format`        | Format maintained source and configuration                                 |
| `npm run check:secrets` | Audit files Git would publish, without printing secrets                    |

Research and training commands are documented separately in [`research/README.md`](research/README.md). They are not part of a normal deployment build.

## Deploy

Push the source repository to GitHub and connect it to **Vercel** or **Cloudflare Workers**. GitHub Pages alone cannot run the required server endpoints.

For Vercel, use the repository root, Node 22, `npm ci`, build command `npm run build` and output `dist/client`. The checked-in `vercel.json` configures the API functions and routing. Set server-side keys in the hosting dashboard; local `.dev.vars` values do not transfer to deployment.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for both hosting paths, environment variables and verification steps.

## Repository layout

```text
src/          React app, components and styles
lib/          Detection, evidence, image-processing and shared assessment logic
server/       Private provider services and the Node HTTP adapter
api/          Thin Vercel function entry points
worker/       Cloudflare Worker entry point
public/       Shipped branding, fonts, examples and license notices
scripts/      Build, formatting and repository safeguards
tests/        Regression tests and authored fixtures
research/     Training, evaluation scripts and inactive validation UI
docs/         Architecture, deployment, methodology and archived research notes
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for component boundaries and request flow.

## Secrets and generated files

Real `.env*` and `.dev.vars*` files, hosting state, dependencies, build output and development reports are ignored by Git. Only sanitised `.example` templates belong in source control. API keys must never use a `VITE_` prefix: those variables are public browser configuration.

The build audits publishable source and generated client files for configured secrets and credential-shaped values. CI runs without production API keys. These checks are additional safeguards; review changes before committing.

## Privacy and limits

OCR, QR decoding and original-file metadata inspection run on the device. With AI backup enabled, unmatched messages or recognized text are sent to the named AI provider. **AI image check** sends a resized image for visual review only if local metadata provides no AI creation marker. **Read message text** uses local OCR first and may send a resized image if OCR fails. Link checks send detected full URLs, including query parameters, to Google. Provider and hosting policies apply. The app does not save scan history.

This is a screening tool. AI, rules and OCR can make mistakes; no result guarantees safety. Metadata is unverified, and screenshots can remove provenance. Current evidence does not establish 90% full-app accuracy; research scope is documented in [`docs/VALIDATION.md`](docs/VALIDATION.md).

Preserved third-party notices are listed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Application code and supplied artwork do not currently carry an open-source license.
