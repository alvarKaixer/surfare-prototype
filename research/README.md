# Research tools

These files are preserved for development and reproducibility. They are not imported by the production client or copied into its public assets. The Validation and older Evaluation screens are inactive.

Run commands from the repository root:

| Command                     | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `npm run validation:report` | Generate regression and local-model statistics in `.reports/validation/`   |
| `npm run validation:ai`     | Run authored scenarios against the local AI endpoint and save all outcomes |
| `npm run model:train`       | Prepare downloaded corpora and train the offline SMS model                 |
| `npm run model:evaluate`    | Evaluate the frozen test partition without changing the model              |

The live AI command requires a running local app and consumes provider quota. It uses authored synthetic fixtures, does not retry misses, and must not be described as independent population accuracy. Keep the local server stable during a run.

Raw corpora remain in `.preview/datasets/` and are not committed. `docs/DETECTION.md` records the original sources, licenses and split procedure. Generated reports are local development artifacts under `.reports/`, excluded from both Git and deployment.

`ui/Validation.tsx` and `validation.css` preserve the validation dashboard for a future deliberate reintroduction. `ui/Evaluation.tsx`, `ui/Benchmark.tsx` and `fixtures/sample-cases.json` preserve older research UI. None is a public route. Restoring these screens also requires explicitly serving their generated reports/fixtures; normal builds do not do that.
