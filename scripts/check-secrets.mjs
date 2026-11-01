import {
  configuredSecrets,
  publishableFiles,
  auditFiles,
  git,
  inspectPublishableText,
} from './lib/repository-audit.mjs';

const secrets = await configuredSecrets(),
  files = await publishableFiles();
const findings = await auditFiles(files, secrets);
if (process.argv.includes('--history')) {
  const objects = git(['rev-list', '--objects', '--all']);
  if (objects.status !== 0) throw Error('Could not inspect repository history.');
  for (const line of objects.stdout.trim().split('\n')) {
    const [object, ...parts] = line.trim().split(' '),
      path = parts.join(' ');
    if (!path || /\.(?:png|jpe?g|webp|ttf|woff2?|wasm|gz)$/i.test(path)) continue;
    const type = git(['cat-file', '-t', object]);
    if (type.stdout.trim() !== 'blob') continue;
    const data = git(['cat-file', 'blob', object]);
    if (data.status !== 0) throw Error('Could not inspect a historical blob.');
    for (const finding of inspectPublishableText(path, data.stdout, secrets)) {
      findings.push({
        file: 'history:' + object.slice(0, 12) + ':' + path,
        reason: finding.reason,
      });
    }
  }
}
if (findings.length) {
  for (const finding of findings) console.error(finding.file + ': ' + finding.reason);
  console.error('Secret audit failed. Values are intentionally not printed.');
  process.exitCode = 1;
} else
  console.log(
    'Secret audit passed: ' +
      files.length +
      ' Git/source candidates checked' +
      (process.argv.includes('--history') ? ', including available Git history.' : '.'),
  );
