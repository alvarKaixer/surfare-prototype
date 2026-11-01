import { configuredSecrets, auditFiles } from './lib/repository-audit.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function builtFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await builtFiles(file)));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}
const files = await builtFiles('dist/client'),
  findings = await auditFiles(files, await configuredSecrets());
for (const file of files) {
  const path = file.replaceAll('\\', '/');
  if (/\/(?:validation|evaluation|research)\//.test(path))
    findings.push({ file, reason: 'research artifact in production output' });
  if (/\.(?:js|html)$/.test(file)) {
    const text = await readFile(file, 'utf8');
    if (
      /generativelanguage\.googleapis\.com|openrouter\.ai\/api\/v1\/chat\/completions/.test(text)
    ) {
      findings.push({ file, reason: 'server provider implementation in browser output' });
    }
  }
}
if (findings.length) {
  for (const finding of findings) console.error(finding.file + ': ' + finding.reason);
  process.exitCode = 1;
} else
  console.log(
    'Build audit passed: no configured secrets, private env files, research artifacts or server provider implementation in client output.',
  );
