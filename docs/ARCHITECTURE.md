# Architecture

Surfare has one client application, shared assessment logic and two thin hosting adapters. It is a Vite application, not a Next.js project.

## Runtime boundaries

| Area                             | Responsibility                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/App.tsx`                    | Checker state, user actions and coordination of optional services                                      |
| `src/components/`                | Input tools, loading state, results, evidence and metadata presentation                                |
| `src/styles/`                    | Application and result styles, including reduced-motion behavior                                       |
| `lib/`                           | Local detection, SMS coefficients, normalization, evidence, result fusion and browser image processing |
| `server/services/semantic.js`    | AI configuration, fixed provider endpoints, consent, input bounds and response validation              |
| `server/services/image.js`       | Bounded image review, sharing consent and grounded message/origin validation                           |
| `server/providers/structured.js` | Shared structured provider calls with timeouts and free-only OpenRouter limits                         |
| `server/services/reputation.js`  | Google Safe Browsing requests and normalized results                                                   |
| `server/http-node.js`            | Bounded Node request conversion and response/error handling for Vercel                                 |
| `api/`                           | Provider environment selection and Vercel route entry points                                           |
| `worker/index.js`                | Cloudflare API routing and static asset delivery                                                       |

`server/` modules are never imported by `src/`. Provider keys exist only in server environments. The browser calls same-origin `/api/assess`, `/api/image-assess` and `/api/verify`; it does not call provider endpoints directly.

## Check flow

1. The client reads service configuration without retrieving keys. Available services start enabled; the sharing disclosure identifies their destinations.
2. The user presses Check. Image-origin mode reads original-file metadata first and skips OCR. Explicit generation markers produce an immediate origin verdict; otherwise an enabled AI visual review receives a resized JPEG. Text mode uses local OCR, with image AI as a reading fallback; QR mode decodes locally.
3. Typed messages, OCR and QR content share `assessContent`. `needsAiBackup` invokes AI only for nonempty content with no local warning (`Insufficient evidence`), when enabled, configured and online. Suspicious and High risk local matches skip AI. Applicable reputation checks can run concurrently. A completed image-reading backup is reused without a second AI request.
4. AI output must match the supported schema and quote exact original evidence. Stronger local danger warnings and known unsafe URL matches are retained.
5. The app presents one completed result after all selected checks settle. Provider failures remain explicit and do not become low-risk verdicts.

The local detector and SMS coefficients are loaded on demand, rather than in the initial JavaScript bundle. OCR starts only when reading image text. Normal OCR uses one bounded pass; enhanced retries and orientation checks are opt-in. Visual review is not a forensic detector, and displayed image confidence describes evidence strength, not a calibrated authenticity probability. No creation marker is required for a scam or threat warning.

## Build flow

`npm run build` audits source for secrets, copies OCR resources from locked dependencies, typechecks the client, builds `dist/client`, creates the offline service worker and audits the generated output. Research reports and inactive validation screens are excluded.

`npm run check` also checks formatting and runs the regression suite. CI uses this command without provider keys. Real-provider checks are explicit research commands and consume provider quota.

## Research boundary

`research/` contains non-production evaluation and training tools. Raw datasets stay in ignored `.preview/datasets/`; generated reports stay in ignored `.reports/`. Archived methodology and model provenance remain in `docs/`. The compact trained SMS coefficients in `lib/models/` are required production assets and are intentionally versioned.

## Hosting

Both hosts call the same Web Request/Response services, so assessment policy is shared. Only the Node HTTP conversion and environment access are host-specific. Tests cover both adapters, request bounds, origin rejection and unavailable-provider behavior.
