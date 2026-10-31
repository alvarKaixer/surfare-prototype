# Surfare Detector

A standalone, GitHub-ready React + Vite application for checking text messages, links, images and QR codes. Includes the proposal-style UI, local OCR/QR processing, OpenCV camera-quality hints, optional Google Safe Browsing, offline resources, contextual guidance and evaluation tools.

This export contains the working detector from the ChatGPT prototype, adapted for ordinary hosting. It does not require ChatGPT sign-in, Sites, a proprietary repository proxy, or an account-specific project ID. Surfy is decorative branding only; the guided assistant is excluded.

## Start here: GitHub + Vercel

1. Extract the ZIP. Open the **surfare** folder in VS Code. This is the folder containing `package.json`, `vercel.json`, `app`, `api`, and `public`.
2. Create a new GitHub repository (for example `surfare-detector`). Prefer a separate repo from the existing proposal website so you can keep both sites. Commit the entire **contents** of this folder, including `.gitignore`, `.github` and `package-lock.json`.
3. In Vercel, choose **Add New → Project → Import Git Repository** and select the new repository.
4. Set **Root Directory** to the folder containing `package.json`. If you pushed the contents directly into the repo root, leave it at the default. If you pushed an enclosing `surfare` folder, select `surfare`.
5. Framework: **Vite**. Node.js: **22.x**. Build command: `npm run build`. Output directory: `dist/client`. Install command: `npm ci`. The included `vercel.json` sets the build/output options and deploys `api/verify.js` as a serverless function.
6. Add a server-side environment variable named **GOOGLE_SAFE_BROWSING_API_KEY**. Paste your Google key as the value, enable it for Production (and Preview if needed), then deploy. If you add or change it later, redeploy.
7. Open the deployed app. Under **Link**, select **Google phishing test**, enable the Google checkbox, and run the check. Expect **High risk**, with `SOCIAL_ENGINEERING` in the Google verification panel.

The key configured for the ChatGPT-hosted copy does **not** transfer to your Vercel account. No real key is included in this ZIP. Do not put a key in source, `vercel.json`, a `VITE_` variable, or GitHub. Restrict it to Safe Browsing API in Google Cloud.

### Optional terminal steps for a new GitHub repository

Replace the repository URL with the exact URL of the empty repository you created. Run from the folder containing `package.json`:

```bash
git init
git add .
git commit -m "Add Surfare detector"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If this folder is already in a Git repository, keep its existing Git configuration and use your normal commit/push flow instead.

## Run locally

Install **Node.js 22 LTS**. Then:

```bash
npm ci
```

Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder with your key. This untracked file is used only by local Cloudflare/Wrangler development. The app also runs without a key, with local detection and an explicit unavailable Google status.

```bash
npm run dev
```

This builds the app and starts it with its local Worker at **http://localhost:8787**. After editing source, stop it and rerun `npm run dev` to rebuild. For UI hot reload, keep the Worker running and run `npm run dev:ui` in a second terminal; Vite proxies `/api` to port 8787.

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run preview` serves the previously built app and local Worker on port 8787. `vite preview` alone is not a complete API preview.

## Alternative: Cloudflare Workers

Cloudflare keeps the PDF's Worker backend architecture. No Vercel function is used on this route.

```bash
npm ci
npx wrangler login
npm run deploy:cloudflare
npx wrangler secret put GOOGLE_SAFE_BROWSING_API_KEY
```

Enter the key at Wrangler's prompt. Keep it out of shell command arguments and tracked files. Open the Workers URL printed by Wrangler, then run the Google phishing test in the app.

You can also connect the GitHub repository through **Cloudflare Workers & Pages → Create → Import a repository**. Choose a Worker (not a static Pages-only project), use build command `npm run build`, deploy command `npx wrangler deploy`, and root directory containing `wrangler.jsonc`. Add the key as a Worker secret. The assets binding and `/api/*` routing are declared in `wrangler.jsonc`.

## Files and architecture

| Path | Purpose |
|---|---|
| `app/page.tsx` | Checker UI, file preview, OCR/QR and camera flow |
| `app/components/` | Evaluation tools and offline readiness display |
| `lib/detection.js` | Local message/URL rules and registered-domain analysis |
| `lib/verification.js` | Google Safe Browsing request logic shared by both hosts |
| `lib/assessment.js` | Combines local evidence with reputation results |
| `lib/file-validation.js` | Image signatures and file-size validation |
| `lib/image-tools.ts` | OpenCV preprocessing and camera-quality hints |
| `lib/evaluation.js` | Dataset metrics and OCR character error rate |
| `api/verify.js` | Vercel serverless backend |
| `worker/index.js` | Cloudflare backend and static assets handler |
| `public/brand`, `public/fonts` | Original Surfare artwork and locally hosted fonts |
| `public/evaluation/` | Synthetic example cases and import format |
| `scripts/copy-ocr.mjs` | Copies OCR worker, WASM, model and OpenCV from npm |
| `scripts/offline.mjs` | Builds the Workbox offline service worker |
| `tests/` | Regression and hosting adapter tests |
| `.github/workflows/checks.yml` | Tests/builds pushes and pull requests |
| `REQUIREMENTS.md` | PDF requirements mapping and boundaries |

OCR assets are generated from locked npm dependencies during every build. You do not need to upload 36 MB of generated files to GitHub. Fonts, mascots, QR examples, evaluation data, source, configuration, dependency lockfile and tests are included. Never upload `node_modules`, `dist`, `.dev.vars`, `.env`, `.vercel`, or `.wrangler`.

## Verify your deployment

- `/api/verify` should return JSON such as `{"configured":true}`. `false` means the server secret is missing. HTML here usually means the backend route was not deployed correctly.
- Run **Google phishing test** with the checkbox enabled. It should report a Google threat; the app does not need to visit the test URL.
- Upload a PNG/JPEG/WebP screenshot, review the preview, and press **Check image**. Correct OCR text if needed.
- Try the built-in QR example. Its destination is displayed without being opened.
- Select **Prepare for offline use**, wait for completion, then check offline on your target browser. Initial download is approximately 36 MB. Browser eviction/private browsing may affect offline reopening.
- Run **Evaluation** with independently labeled cases for research. Included synthetic cases are demonstrations, not evidence of real-world accuracy.

## Troubleshooting

**Vercel 404:** Check Root Directory and Output Directory (`dist/client`). Do not deploy the `app` folder by itself.

**Google not configured:** Add `GOOGLE_SAFE_BROWSING_API_KEY` on the correct host/environment and redeploy. It is intentionally absent from the source.

**Google unavailable:** Verify that Safe Browsing API is enabled, the key restrictions permit that API, and your quota is available. Server-side calls must not use browser HTTP-referrer restrictions.

**Old interface after deployment:** Hard-refresh. If you enabled offline mode, close old tabs and reopen online to let the service worker update. Clear that site's storage if necessary.

**OCR fails offline:** Prepare offline resources while online and wait for completion. Do not remove `public/ocr` from the built output; it is automatically generated before build.

## Scope and privacy

Messages and images are processed in the browser. Only opted-in full URLs, including query parameters, are sent through the server to Google. No scan history is stored by the app. Evaluation inputs stay in the current tab until explicitly exported. Hosting and provider infrastructure have their own policies.

Safe Browsing is for noncommercial use under Google's terms and quotas. This exported app has no ChatGPT owner-only access gate; configure your host's access controls if you want a private demo. Review your API quotas before sharing widely.

This is a heuristic prototype, not a validated security product. A no-match response does not prove safety. Live redirect chains are not followed; redirect parameters are inspected. Images are not authenticated and AI-generated media is not detected. One visible QR per image is supported. OCR uses an English Latin-character model. Actual accuracy requires independent labeled data and participant evaluation.

Deployment adapters are tested locally; publishing into your own Vercel/Cloudflare account must be completed there.
