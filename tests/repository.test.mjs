import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublishableText, isPrivateFile } from '../scripts/lib/repository-audit.mjs';

test('real environment files are private while sanitised examples remain publishable', () => {
  for (const file of [
    '.env',
    '.env.local',
    'nested/.env.production',
    '.dev.vars',
    '.dev.vars.preview',
    'service.key',
    'credentials-local.json',
  ])
    assert.equal(isPrivateFile(file), true);
  for (const file of ['.env.example', '.dev.vars.example', 'src/App.tsx'])
    assert.equal(isPrivateFile(file), false);
});

test('credential-shaped source values are rejected without revealing the value', () => {
  for (const value of [
    ['AI', 'za', 'x'.repeat(35)].join(''),
    ['sk', 'or', 'v1', 'a'.repeat(64)].join('-'),
  ]) {
    const findings = inspectPublishableText(
      'src/example.js',
      'const key = ' + JSON.stringify(value),
    );
    assert.equal(findings[0].reason, 'credential-shaped value');
    assert(!JSON.stringify(findings).includes(value));
  }
});

test('exact configured secrets and private-key material are rejected', () => {
  const value = 'generated-for-test-' + 'z'.repeat(20);
  assert(
    inspectPublishableText('example.json', JSON.stringify({ value }), [value]).some(
      (f) => f.reason === 'configured secret value',
    ),
  );
  const header = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
  assert(
    inspectPublishableText('example.txt', header).some((f) => f.reason === 'private key material'),
  );
  assert.deepEqual(
    inspectPublishableText('.env.example', 'OPENROUTER_API_KEY=\nAI_PROVIDER=auto'),
    [],
  );
});
