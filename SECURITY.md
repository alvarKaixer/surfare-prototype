# Security

Do not include credentials, private messages or uploaded images in public issues or pull requests. Use GitHub private vulnerability reporting if the repository owner has enabled it; otherwise contact the owner privately before sharing sensitive details.

Real environment files are ignored. Production credentials belong in server-side hosting settings, not `VITE_` variables, browser code or tracked configuration. If a key has been exposed, revoke or rotate it; adding the file to `.gitignore` does not remove an already published secret from history.

`npm run check:secrets` checks publishable source without printing secret values. `npm run build` also inspects the generated client. These safeguards detect common credential shapes and configured values; they do not replace review or provider-side restrictions.
