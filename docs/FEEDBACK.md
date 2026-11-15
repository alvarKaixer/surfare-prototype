# Optional feedback

Feedback is independent of checking content. Neither checking nor viewing a result submits feedback. The form is offered after message, URL, OCR-text and QR assessments; image-origin judgments have a different label system and are not included in this risk-feedback form.

The compact form starts with four choices: Looks right, Too cautious, Missed a risk, and Not sure. After choosing, the user sees a sharing summary and a consent checkbox. Tags, an expected category and separately consented excerpts are under Add details. Manage feedback is under Options & privacy; a post-submission shortcut opens it and shows delivery status for that specific submission.

The user selects fixed tags, a correction and an optional expected risk category. No source text, sender, URL, model quotation or image is attached. A second checkbox permits a manually entered excerpt of up to 600 characters. The preview removes common links, emails, numeric identifiers and secrets before the user approves it. Names and indirect identifiers are not reliably detected: the UI asks the user to remove them. The server rejects unfiltered excerpts, unknown fields and non-allowlisted tags. An excerpt is not anonymous merely because it has been filtered.

## Connect storage

1. In your Supabase project, run `supabase/feedback.sql` with the SQL editor as an administrator. It creates a restricted table, service-only submission/withdrawal functions, and an hourly expiry job. Confirm that the Cron extension and `surfare-feedback-expiry` job are active before enabling collection.
2. Add `SUPABASE_URL` and the private legacy `SUPABASE_SERVICE_ROLE_KEY` to `.dev.vars` for local use, or to the server environment in Vercel/Cloudflare. Use the HTTPS project URL, such as `https://your-project.supabase.co`. Never prefix a private key with `VITE_`.
3. Set `FEEDBACK_ENABLED=true` and restart the server. Until configured, the form clearly says storage is disconnected; the user can still explicitly queue feedback locally.

The migration has been supplied, not applied automatically. Database deployment and live feedback acceptance require the project owner's Supabase configuration. Only authorized project team members should use the Supabase dashboard to review records. No public browsing/list endpoint is provided. The table has RLS enabled, no public policies, and no grants to anonymous or ordinary authenticated users. See [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Retention and withdrawal

- Explicitly approved pending feedback is encrypted with AES-256-GCM in IndexedDB, with a non-exportable CryptoKey stored separately in the same database. The app never persists a scan automatically. This protects the representation at rest but does not protect against malicious same-origin scripts or someone using an unlocked browser profile.
- The browser queue holds at most 30 pending items/receipts. Pending submissions expire after seven days and are pruned when the app next opens/accesses storage. Automatic sending occurs only while the page is open and online; no service-worker background sync is used. Failed sends use capped backoff.
- Successful submission removes the local excerpt and retains only an encrypted deletion receipt. Server content expires after 30 days and is physically removed by hourly cleanup (up to one extra hour). Local receipts expire after 31 days and are pruned on the next access.
- “Withdraw & delete” immediately removes local queued content and queues a server withdrawal. An offline deletion completes only when connected again. Server withdrawal nulls the payload and retains only an opaque ID, deletion-token hash and operational timestamps/status for 37 days, preventing an in-flight retry from restoring deleted content.
- Clearing local storage loses deletion receipts and does not delete already submitted content. The UI explains this and requires explicit acknowledgement. Provider infrastructure logs and backups have their own retention; this feature does not override those policies.

## Review and improvement

Use `review_status` (`unreviewed`, `reviewed`, `excluded`) in the dashboard to track review. User corrections are unverified reports, not ground-truth labels. Review context, remove inappropriate excerpts, group repeated reports, and propose rule/prompt changes in Git. Evaluate those changes on untouched examples before release. Do not automatically train on submissions or use feedback counts as accuracy claims.

The SQL functions serialize submissions, make retries idempotent, and impose a global ceiling of 2,000 new records per day without collecting IP addresses. This is a storage backstop, not a per-user abuse control. Configure hosting rate limits before broad public exposure. Logs must not include request bodies or deletion tokens. No RA 10173 compliance certification is claimed.

## Validation status

Behavioral tests, browser tests, live database checks and accuracy evaluation are deferred at the user's request. Compilation/build checks do not establish runtime correctness or improved detection accuracy.
