# Development changes and data provenance

This iteration adds development-informed rules and changes contextual review. It does not retrain the SMS classifier or establish a new accuracy figure. All behavioral testing and evaluation remain deferred.

## User-supplied datasets

- A.S.E.A. `Final_Dataset/Combined-Dataset-V3(Sheet).csv`, supplied from https://github.com/ChrisThePCGamer/asea-sms-scam-detection . SHA-256: `7860558217d73f48e6789727049527aec64de456727d77f6321e709fb9f7bf29`. Reuse license has not been confirmed. User authorized local development use. No raw rows or downloaded model weights are distributed.
- PhiUSIIL `PhiUSIIL_Phishing_URL_Dataset.csv`, Arvind Prasad and Shalini Chandra (2024), UCI, https://doi.org/10.1016/j.cose.2023.103545, CC BY 4.0. SHA-256: `a236549cd369cd80bd478ff8e1779cbf44c58d5c3f79f7a51a1adbed7d06d1c6`. Its labels use `1` for legitimate and `0` for phishing. Website-derived features are not available to Surfare's URL-only detector; they must not be mistaken for inputs the app can observe.

`research/scripts/import-development-data.py` records hashes and splits under ignored `.preview/datasets/`. Message templates group normalized text after masking numeric sequences and URLs; URL examples group by hostname. Groups with conflicting labels are excluded and exact duplicates within a group are removed. A deterministic hash assigns approximately 20% of groups to holdout. Existing upstream train/validation/test membership is unknown for this combined file. Cross-corpus and near-duplicate audits against earlier training data remain necessary before any claim of independent evaluation. Hostname grouping does not guarantee separation of registrable domains.

The import produced 2,905 development messages and 699 held-out messages, excluding 148 conflicting template groups. There are 189,339 development URL rows and 45,919 held-out rows, excluding 54 conflicting hostname groups. These are corpus counts, not detector scores. Held-out message/URL content has not been inspected or evaluated. Only a small set of development message examples was reviewed; PhiUSIIL has been staged for later URL work, not used to fit a model.

The message source includes commercial spam, gambling promotions, HAM, duplicated bank-category names, Other and generic spam labels. Sample labels sometimes describe ordinary notifications or greetings as scams. They are not accepted as verified fraud labels. Category names informed targeted combinations of a request and context, rather than a rule that marks all loans, gambling, promotions or reminders as fraud.

## Detection changes

- Added combined signals for loan-release fees, task-job deposits/recruitment, cancellation-link lures, benefit claims through unverified contacts, prepaid-load dial codes, and promises of controlled winnings.
- Extended word obfuscation normalization to embedded `@`, preserving highlight offsets.
- Limited brand-reference warnings to hostname impersonation or actionable account/security context, rather than every mention of a brand next to a third-party link.
- Require at least one stronger signal for a high-risk local result. Several weak hints alone remain suspicious.
- Allow contextual review for Suspicious as well as Insufficient evidence results. Strong high-risk local findings still skip AI. This can increase free-provider usage and rate-limit failures.
- Allow AI to resolve only weak, non-URL, non-personal-safety local hints to Low risk; preserve reviewed hints in a disclosure. Explicit scam requests, personal-safety and URL warnings remain. Safe Browsing threats still override to High risk. No reputation match never establishes safety.
- Expanded prompts to distinguish promotional content, genuine OTP notifications and protective advice from requests for secrets or money. Prompts explicitly avoid inventing a later deposit demand or claiming domain reputation without evidence.

The earlier SMS coefficients remain unchanged. A substantial accuracy gain cannot be claimed without the deferred evaluation, including false-positive analysis, per-language results and coverage.
