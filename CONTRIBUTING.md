# Contributing

Use Node 22 and install dependencies with `npm ci`. Run the complete local app with `npm run dev`; optional Vite hot reload is available through `npm run dev:ui`.

Before opening a pull request:

```bash
npm run format
npm run check
```

Keep UI code in `src/`, provider logic in `server/`, shared detection in `lib/` and experimental evaluation in `research/`. Preserve both hosting adapters when changing API behavior.

Add meaningful regressions for detection, request validation or data-handling changes. Tests must use synthetic fixtures and mocked external providers. Real-provider research checks are explicit commands, not part of CI.

Do not include keys, local environment files, user messages, dependency folders or generated reports in commits, issues or screenshots. Use sanitised `.example` templates for new variables. Keep `package-lock.json` synchronized with dependency changes.

Document any material change to data sharing or assessment limitations. Do not turn regression pass rates or small authored examples into real-world accuracy claims.
