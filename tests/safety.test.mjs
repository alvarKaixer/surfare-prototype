import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, analyzeUrl, extractUrls } from '../lib/detection.js';
import { assessContent } from '../lib/content-assessment.js';
import { guidance } from '../lib/guidance.js';
import { evidenceSegments } from '../lib/text-evidence.js';
import { evaluateCases } from '../lib/evaluation.js';
import { applySemanticAssessment } from '../lib/semantic-assessment.js';

const reportedExtortion =
  'pre gago ka ba, sendan mo nako ng pera tanginamo may araw karin sakin, delikado na pati pamilya mo pag di mo sinend ngayon';
for (const text of [
  reportedExtortion,
  'Sendan mo na ko ng pera. May araw ka rin sa akin.',
  'Magpadala ka ng pera ngayon, delikado ang pamilya mo pag hindi.',
  'Delikado na pati anak mo pag di ka nagpadala ng pera.',
  'May araw ka din sakin. Bayaran mo ang pera ngayon.',
])
  test('implied retaliation with a money demand is high risk: ' + text, () => {
    const result = assessContent({ text });
    assert.equal(result.level, 'High risk');
    const extortion = result.indicators.find((i) => i.id === 'extortion');
    assert(extortion);
    assert(extortion.evidence.some((e) => /pera/.test(e.text)));
    assert(extortion.evidence.some((e) => /may araw|delikado/i.test(e.text)));
    for (const e of extortion.evidence) assert.equal(text.slice(e.start, e.end), e.text);
  });
test('reported extortion stays high risk on every input path when AI times out', () => {
  for (const kind of ['message', 'link', 'image', 'qr']) {
    const local = assessContent({ text: reportedExtortion, kind, uncertain: kind === 'image' });
    assert.equal(applySemanticAssessment(local, { status: 'unavailable' }).level, 'High risk');
  }
});
for (const text of [
  'May araw ka rin para magpahinga.',
  'Sendan mo na ko ng pera para sa pagkain ng pamilya mo.',
  'Hindi delikado ang pamilya mo. Sendan mo ko ng pera para sa pagkain.',
  'Delikado ang daan, mag-ingat kayo ng pamilya mo.',
  'Huwag mong sabihin na may araw ka rin sa akin.',
])
  test('ordinary requests and protective advice do not become extortion: ' + text, () => {
    assert(!assessContent({ text }).indicators.some((i) => i.category === 'personal safety'));
  });

const threats = [
  'tanginamo pare yang kapatid mo na yan di pako binabayaran, pag ako nainis tanggal ang ulo nya',
  'Pag ako nainis, putol ang leeg mo.',
  'Pupugutan ko siya ng ulo.',
  'sendan moko ng pera ngayon o papatayin kita 095583723',
  'Papatayin kita.',
  'PAPATAYIN KITA',
  'papatayinkita',
  'P4p4t4yin kita',
  'Hindi ako nagbibiro papatayin kita',
  'Babarilin kita pag nakita kita.',
  'Sasaktan ko ang pamilya mo.',
  'Sasaksakin ka namin.',
  'Bubugbugin kita mamaya.',
  'I will kill you.',
  "I'll hurt your family.",
  'Send money or I will shoot you.',
  'Do not ignore me I will kill you',
  'Magpadala ng pera o ikakalat ko ang pictures mo.',
  'Pay money or I will post your private photos.',
  'Ikakalat ko ang video mo.',
  '🚨 ｐａｐａｔａｙｉｎ ｋｉｔａ',
  'papa\u200btayin kita',
];
for (const text of threats)
  test('high-risk personal safety: ' + text, () => {
    const r = assessContent({ text });
    assert.equal(r.level, 'High risk');
    assert(r.indicators.some((i) => i.category === 'personal safety'));
    assert(guidance(r).some((s) => s.includes('Save the original message')));
    for (const indicator of r.indicators)
      for (const e of indicator.evidence) assert.equal(text.slice(e.start, e.end), e.text);
  });
const benign = [
  'Tanggal ang ulo ng manika, kailangan ayusin.',
  'Huwag mong sabihin na tanggal ang ulo nya.',
  'Patayin mo ang ilaw bago matulog.',
  'Papatayin ko ang computer mamaya.',
  'I will kill the process on my computer.',
  'This workout is killing me today.',
  'Hindi kita papatayin, tutulungan kita.',
  "I won't hurt you, you are safe here.",
  'Huwag mong sabihin na papatayin kita.',
  'Never share your OTP or password with anyone.',
  'Huwag ibigay ang OTP o password mo sa iba.',
  'Paki patayin ang electric fan bago umalis.',
  'Sendan mo ko ng picture ng assignment natin.',
  'Pakisend ng pera para sa pagkain natin.',
  'Lin y a sa pelikula: ang character ay nagsabi ng papatayin kita.',
  'We will shoot your family portrait at the studio tomorrow.',
];
for (const text of benign)
  test('benign context is not flagged or certified safe: ' + text, () => {
    const r = assessContent({ text });
    assert.equal(r.level, 'Insufficient evidence');
    assert(!r.indicators.some((i) => i.category === 'personal safety'));
  });
test('negated advice cannot cancel an independent secret request', () => {
  const r = analyze('Huwag ibigay ang OTP mo. Pero send your password now.');
  assert.equal(r.level, 'High risk');
  const secret = r.indicators.find((i) => i.id === 'secret');
  assert(secret.evidence.some((e) => e.text === 'password'));
  assert(!secret.evidence.some((e) => e.text === 'OTP'));
});
test('all four input paths keep a direct threat high risk', () => {
  for (const kind of ['message', 'link', 'image', 'qr'])
    assert.equal(
      assessContent({ text: threats[0], kind, uncertain: kind === 'image' }).level,
      'High risk',
    );
});
test('unreliable OCR cannot receive a low-risk verdict', () =>
  assert.equal(
    assessContent({ text: 'Our meeting is tomorrow afternoon.', kind: 'image', uncertain: true })
      .level,
    'Insufficient evidence',
  ));
test('non-URL QR threat is analyzed, Wi-Fi QR stays unconfirmed', () => {
  assert.equal(assessContent({ text: 'Papatayin kita', kind: 'qr' }).level, 'High risk');
  assert.equal(
    assessContent({ text: 'WIFI:T:WPA;S:Home network;P:password here;;', kind: 'qr' }).level,
    'Insufficient evidence',
  );
});
test('no-match reputation cannot downgrade a violence threat', () =>
  assert.equal(
    assessContent({
      text: threats[0] + ' https://example.com',
      verification: { status: 'completed', results: [{ threats: [] }] },
    }).level,
    'High risk',
  ));
test('evidence segments preserve exact text, including HTML-like content and overlapping flags', () => {
  const text = '<img src=x onerror=alert(1)> Send your OTP now or your account will be blocked.';
  const r = analyze(text),
    segments = evidenceSegments(text, r.indicators);
  assert.equal(segments.map((s) => s.text).join(''), text);
  assert(segments.some((s) => s.ids.includes('secret')));
});
test('unusual supported suffix is extracted', () =>
  assert.deepEqual(extractUrls('Check https://account.example or offers.technology'), [
    'https://account.example',
    'offers.technology',
  ]));
test('lookalike and executable URLs are flagged', () => {
  assert(
    analyzeUrl('https://paypa1.com/login').indicators.some((i) => i.id === 'lookalike-paypal'),
  );
  assert(analyzeUrl('https://example.com/bank.apk').indicators.some((i) => i.id === 'download'));
});
test('protocol-relative redirect is inspected without fetching', () =>
  assert(
    analyzeUrl('https://example.com/?next=//other.example/login').indicators.some(
      (i) => i.id === 'redirect',
    ),
  ));
test('defanged URL detection preserves original evidence', () => {
  const text = 'Verify here hxxps://gcash[.]com[.]attacker.com/login';
  const r = analyze(text);
  assert.equal(r.urls[0].domain, 'attacker.com');
  assert(r.indicators.some((i) => i.id === 'brand-gcash' && i.evidence[0].text.includes('[.]')));
});
test('unrelated fictional context cannot suppress a separate real threat', () =>
  assert.equal(analyze('We watched a movie with a villain. I will kill you.').level, 'High risk'));
test('evaluation includes harmful labels and counts uncertainty as a miss', () => {
  const r = evaluateCases([
    { text: 'papatayin kita', label: 'harmful', language: 'Filipino' },
    { text: 'Patayin mo ang ilaw bago matulog.', label: 'legitimate', language: 'Filipino' },
    { text: 'https://example.com', label: 'legitimate', language: 'English' },
  ]);
  assert.equal(r.overall.accuracy, 1 / 3);
  assert.equal(r.overall.abstain, 2);
  assert.equal(r.overall.balancedAccuracy, 0.5);
  assert.equal(r.macroLanguageAccuracy, 0.25);
});
