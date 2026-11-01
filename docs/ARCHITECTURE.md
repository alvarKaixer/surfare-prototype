# Architecture

Surfare has one client application, shared assessment logic and two thin hosting adapters. It is a Vite application, not a Next.js project.

## Runtime boundaries

| Area                            | Responsibility                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/App.tsx`                   | Checker state, user actions and coordination of optional services                                      |
| `src/components/`               | Input tools, loading state, results, evidence and metadata presentation                                |
| `src/styles/`                   | Application and result styles, including reduced-motion behavior                                       |
| `lib/`                          | Local detection, SMS coefficients, normalization, evidence, result fusion and browser image processing |
| `server/services/semantic.js`   | AI configuration, fixed provider endpoints, consent, input bounds and response validation              |
| `server/services/reputation.js` | Google Safe Browsing requests and normalized results                                                   |
| `server/http-node.js`           | Bounded Node request conversion and response/error handling for Vercel                                 |
| `api/`                          | Provider environment selection and Vercel route entry points                                           |
| `worker/index.js`               | Cloudflare API routing and static asset delivery                                                       |

`server/` modules are never imported by `src/`. Provider keys exist only in server environments. The browser calls same-origin `/api/assess` and `/api/verify`; it does not call provider endpoints directly.

## Check flow

1. The client reads service configuration without retrieving keys. Available services start enabled; the sharing disclosure identifies their destinations.
2. The user presses Check. Images are processed locally first, producing OCR text and/or QR content.
3. Local checks run through `assessContent`. Selected AI and reputation requests run concurrently, only when configured and applicable.
4. AI output must match the supported schema and quote exact original evidence. Stronger local danger warnings and known unsafe URL matches are retained.
5. The app presents one completed result after all selected checks settle. Provider failures remain explicit and do not become low-risk verdicts.

## Build flow

`npm run build` audits source for secrets, copies OCR resources from locked dependencies, typechecks the client, builds `dist/client`, creates the offline service worker and audits the generated output. Research reports and inactive validation screens are excluded.

`npm run check` also checks formatting and runs the regression suite. CI uses this command without provider keys. Real-provider checks are explicit research commands and consume provider quota.

## Research boundary

`research/` contains non-production evaluation and training tools. Raw datasets stay in ignored `.preview/datasets/`; generated reports stay in ignored `.reports/`. Archived methodology and model provenance remain in `docs/`. The compact trained SMS coefficients in `lib/models/` are required production assets and are intentionally versioned.

## Hosting

Both hosts call the same Web Request/Response services, so assessment policy is shared. Only the Node HTTP conversion and environment access are host-specific. Tests cover both adapters, request bounds, origin rejection and unavailable-provider behavior.
