import test from 'node:test';
import assert from 'node:assert/strict';
import { assessContent } from '../lib/content-assessment.js';
import { needsAiBackup } from '../lib/assessment-policy.js';

const available = { enabled: true, configured: true, online: true };
const bait =
  'I have left you some money for us to meet in the next life. Farewell. Website: https://example.com Username:demo-user Password:demo-only Balance:6303050.5 USDT';

for (const kind of ['message', 'image', 'qr']) {
  test(`${kind}: crypto-account bait is a local High risk warning without AI`, () => {
    const local = assessContent({ text: bait, kind });
    assert.equal(local.level, 'High risk');
    assert(local.indicators.some((i) => i.id === 'account-bait'));
    assert.match(local.summary, /crypto-account scam/);
    assert.equal(needsAiBackup(local, available), false);
    for (const finding of local.indicators)
      for (const evidence of finding.evidence) {
        assert.equal(local.sourceText.slice(evidence.start, evidence.end), evidence.text);
      }
  });
}

for (const text of [
  'pre gago ka ba, sendan mo nako ng pera tanginamo may araw karin sakin, delikado na pati pamilya mo pag di mo sinend ngayon',
  'tanginamo pare yang kapatid mo na yan di pako binabayaran, pag ako nainis tanggal ang ulo nya',
])
  test('clear Taglish threat does not require an AI call: ' + text, () => {
    const local = assessContent({ text });
    assert.equal(local.level, 'High risk');
    assert.equal(needsAiBackup(local, available), false);
  });

test('all matched warning levels skip AI, including local Suspicious signals', () => {
  for (const level of ['Suspicious', 'High risk', 'Low risk']) {
    assert.equal(needsAiBackup({ level, sourceText: 'test message' }, available), false);
  }
});

test('unmatched nonempty content uses available AI backup, including ordinary language', () => {
  for (const text of [
    'Our meeting is tomorrow afternoon.',
    'I will make sure your family never sees you again.',
  ]) {
    const local = assessContent({ text });
    assert.equal(local.level, 'Insufficient evidence');
    assert.equal(needsAiBackup(local, available), true);
  }
});

test('offline, disabled, unconfigured and empty checks never invoke AI', () => {
  const local = assessContent({ text: 'Our meeting is tomorrow afternoon.' });
  for (const setting of ['enabled', 'configured', 'online']) {
    assert.equal(needsAiBackup(local, { ...available, [setting]: false }), false);
  }
  assert.equal(
    needsAiBackup({ level: 'Insufficient evidence', sourceText: ' \n ' }, available),
    false,
  );
  assert.equal(needsAiBackup(null, available), false);
});

test('a crypto balance or a farewell alone does not trigger the account-bait rule', () => {
  for (const text of [
    'My balance is 10 USDT. Username:demo-user Password:demo-only',
    'Farewell, I have left you some money in the envelope on your desk.',
    'Report this scam: never send your password. Balance: 100 USDT.',
  ])
    assert(!assessContent({ text }).indicators.some((i) => i.id === 'account-bait'));
});
