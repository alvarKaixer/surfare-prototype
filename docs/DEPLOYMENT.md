# Deployment

## Prepare the GitHub repository

From the repository root:

```bash
npm ci
npm run check
git status --short
```

Review the changes, including deletions and file moves, before staging and committing. The existing Git configuration and history are preserved. Do not upload the entire folder as a ZIP: that would bypass `.gitignore` and could include local credentials and dependency caches.

Commit source, configuration, lockfile, tests and sanitised environment examples. Do not force-add ignored files. `.dev.vars`, `.env*` secrets, `node_modules`, `dist`, `.preview`, `.reports`, `.wrangler`, `.vercel` and generated `public/ocr` assets do not belong in GitHub.

The repository's GitHub Actions workflow installs locked dependencies and runs `npm run check` on pushes and pull requests. It needs no provider secrets.

## Server environment

| Variable                       | Use                                         | Default                 |
| ------------------------------ | ------------------------------------------- | ----------------------- |
| `OPENROUTER_API_KEY`           | OpenRouter credentials                      | Unconfigured            |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Google Safe Browsing credentials            | Unconfigured            |
| `AI_PROVIDER`                  | `auto`, `openrouter` or `gemini`            | `auto`                  |
| `OPENROUTER_MODEL`             | Free router or an explicit `:free` model    | `openrouter/free`       |
| `OPENROUTER_IMAGE_MODEL`       | Optional free vision-capable model override | `openrouter/free`       |
| `GEMINI_API_KEY`               | Optional Google Gemini credentials          | Unconfigured            |
| `GEMINI_MODEL`                 | Optional Gemini model override              | `gemini-3.1-flash-lite` |

`auto` prefers OpenRouter when its key exists. It does not retry through Gemini after an OpenRouter failure. Paid OpenRouter model IDs are rejected and provider price ceilings are zero.

Use `.dev.vars` for local Wrangler development. Production keys go in the selected host's environment/secret settings and must be configured separately for each deployment environment. Never prefix a key with `VITE_`, put it in `vercel.json`/`wrangler.jsonc`, or commit it. Keep key restrictions compatible with the corresponding server-side API.

## Vercel

1. Import the GitHub repository and select its root directory.
2. Use Node 22, install command `npm ci`, build command `npm run build` and output `dist/client`.
3. Add the required server environment variables for Production and any desired Preview environment.
4. Deploy. Redeploy after changing server variables.

`vercel.json` declares the Vite output, server-function durations, API-safe rewrites and service-worker cache header. `api/assess.js`, `api/image-assess.js` and `api/verify.js` must deploy as server functions. The image route uses the existing AI key; Gemini is optional when OpenRouter is configured.

## Cloudflare Workers

The existing `wrangler.jsonc` declares the Worker entry point, static assets and `/api/*` routing.

```bash
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put GOOGLE_SAFE_BROWSING_API_KEY
npm run deploy:cloudflare
```

Enter secret values at the prompts, not in command arguments. Optional non-secret model overrides can be set as Worker environment variables. Deploy as a Worker with assets; a static-only host will not run the API.

## Verify a deployment

- The homepage loads and displays the available checks.
- `/api/assess`, `/api/image-assess` and `/api/verify` return JSON configuration status, never keys or HTML.
- A clear local warning skips AI; unmatched text invokes enabled AI backup. Failures remain visibly unavailable.
- The built-in Google phishing test reports `SOCIAL_ENGINEERING` with link checks enabled. There is no need to open its destination.
- AI image check shows explicit generation metadata without downloading OCR or sending the image. When metadata is absent, enabled visual review uses the image route.
- Read message text, editable OCR and QR decoding work on the target browser.
- Preparing offline resources enables local checks and OCR; AI and reputation still require a connection.
- Validation navigation and research reports are absent from the deployed app.

Provider endpoints consume the deployment's quotas. If the deployment is intended to be private, apply the host's access controls rather than relying on an unlisted URL.

## Build artifacts

Deploy only through the declared build configuration. `dist/client` contains public assets; provider services stay in the server adapters. The build rejects private env files, known configured secrets, credential-shaped values, server provider implementations and research artifacts in the browser output.
