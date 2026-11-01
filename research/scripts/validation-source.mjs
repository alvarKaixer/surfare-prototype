import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function detectorFingerprint() {
  const files = (await readdir('lib'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => 'lib/' + f)
    .concat(
      'lib/models/sms-model.json',
      'server/services/semantic.js',
      'server/services/reputation.js',
      'server/http-node.js',
      'worker/index.js',
      'api/assess.js',
      'api/verify.js',
    )
    .sort();
  const hash = createHash('sha256');
  for (const file of files)
    hash
      .update(file + '\0')
      .update(await readFile(file))
      .update('\0');
  return hash.digest('hex');
}
