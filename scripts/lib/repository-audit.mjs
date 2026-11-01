import { readFile, readdir, lstat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  '.preview',
  '.reports',
  '.wrangler',
  '.vercel',
  'coverage',
  '.idea',
  '.vscode',
  '__pycache__',
  'logs',
]);
const textExtensions =
  /\.(?:[cm]?[jt]sx?|jsonc?|html|css|md|txt|ya?ml|toml|ini|conf|xml|svg|webmanifest|example|py|sh|ps1|map)$/i;
const exampleNames = new Set(['.env.example', '.dev.vars.example']);

export function isPrivateFile(file) {
  const name = basename(file);
  return (
    (!exampleNames.has(name) && (name.startsWith('.env') || name.startsWith('.dev.vars'))) ||
    /\.(?:pem|key|p12|pfx)$/i.test(name) ||
    /^credentials.*\.json$/i.test(name)
  );
}

export function inspectPublishableText(file, text, secrets = []) {
  const findings = [];
  if (isPrivateFile(file)) findings.push('private credential file');
  if (/AIza[A-Za-z0-9_-]{35}/.test(text) || /sk-(?:or-v1-)?[A-Za-z0-9_-]{32,}/.test(text)) {
    findings.push('credential-shaped value');
  }
  if (/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(text)) findings.push('private key material');
  if (secrets.some((secret) => secret.length >= 16 && text.includes(secret))) {
    findings.push('configured secret value');
  }
  return [...new Set(findings)].map((reason) => ({ file, reason }));
}

export function git(args, options = {}) {
  return spawnSync(
    'git',
    ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'), ...args],
    {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    },
  );
}

export async function walkFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name) && path.replaceAll('\\', '/') !== 'public/ocr') {
        files.push(...(await walkFiles(path)));
      }
    } else if (entry.isFile()) files.push(path.replaceAll('\\', '/'));
  }
  return files;
}

export async function publishableFiles() {
  const result = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
  if (result.status === 0) return [...new Set(result.stdout.split('\0').filter(Boolean))];
  // Hosting source archives may not contain .git. Actual env files remain local.
  if (git(['rev-parse', '--is-inside-work-tree']).status === 0)
    throw Error('Could not inspect Git candidates.');
  return (await walkFiles('.'))
    .map((file) => relative('.', file).replaceAll('\\', '/'))
    .filter((file) => !isPrivateFile(file));
}

export async function configuredSecrets() {
  const values = new Set();
  for (const [name, value] of Object.entries(process.env)) {
    if (
      /(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name) &&
      typeof value === 'string' &&
      value.length >= 16
    )
      values.add(value);
  }
  for (const name of await readdir('.')) {
    if (exampleNames.has(name) || !(name.startsWith('.env') || name.startsWith('.dev.vars')))
      continue;
    if (!(await lstat(name)).isFile()) continue;
    for (const line of (await readFile(name, 'utf8')).split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && /(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(match[1])) {
        const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
        if (value.length >= 16 && !/^(?:replace|your[_ -]|test|unit-test|placeholder)/i.test(value))
          values.add(value);
      }
    }
  }
  return [...values];
}

export async function auditFiles(files, secrets) {
  const findings = [];
  for (const file of files) {
    try {
      if (isPrivateFile(file)) {
        findings.push({ file, reason: 'private credential file' });
      } else if (
        (await lstat(file)).isFile() &&
        (textExtensions.test(file) || basename(file).startsWith('.'))
      ) {
        findings.push(...inspectPublishableText(file, await readFile(file, 'utf8'), secrets));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return findings;
}
