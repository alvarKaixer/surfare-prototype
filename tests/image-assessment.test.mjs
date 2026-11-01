import test from 'node:test';
import assert from 'node:assert/strict';
import { imageCheck } from '../server/services/image.js';
import { validateImageAssessment } from '../lib/image-assessment.js';
import { imageOriginVerdict } from '../lib/image-origin.js';
import worker from '../worker/index.js';
import adapter from '../api/image-assess.js';

const env = { OPENROUTER_API_KEY: 'unit-test-placeholder-not-a-real-key' };
// Only a synthetic signature is needed: the provider is mocked in these unit tests.
const image = 'data:image/jpeg;base64,/9j/2Q==';
const emptyAnalysis = {
  level: 'Insufficient evidence',
  summary: 'No readable message.',
  recommendation: 'Use a readable message for a safety check.',
  findings: [],
};
const review = {
  extractedText: '',
  analysis: emptyAnalysis,
  origin: {
    label: 'Uncertain',
    summary: 'The image does not provide clear evidence.',
    observations: [],
  },
};
const req = (overrides = {}, headers = {}) =>
  new Request('https://surfare.example/api/image-assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      image,
      mode: 'origin',
      consent: true,
      provider: 'openrouter',
      ...overrides,
    }),
  });
const provider = (value) =>
  Response.json({
    model: 'test/vision:free',
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }],
  });

test('image configuration contains no credentials and independently enforces free vision models', async () => {
  const response = await imageCheck(new Request('https://surfare.example/api/image-assess'), {
    ...env,
    OPENROUTER_MODEL: 'test/text:free',
  });
  const config = await response.json();
  assert.equal(config.model, 'openrouter/free');
  assert.equal(config.configured, true);
  assert(!JSON.stringify(config).includes(env.OPENROUTER_API_KEY));
  const paid = await imageCheck(req(), { ...env, OPENROUTER_IMAGE_MODEL: 'test/paid' }, () =>
    assert.fail('Must not call a paid provider'),
  );
  assert.equal(paid.status, 503);
});

test('image sharing, origin, provider, mode, body bounds and JPEG data are validated before calling AI', async () => {
  for (const [request, status] of [
    [req({ consent: false }), 400],
    [req({}, { origin: 'https://evil.example' }), 403],
    [req({ provider: 'gemini' }), 409],
    [req({ mode: 'anything' }), 400],
    [req({ image: 'https://example.com/photo.jpg' }), 400],
    [req({ image: 'data:image/jpeg;base64,aGVsbG8=' }), 400],
    [req({ image: image + 'A' }), 400],
    [req({}, { 'content-length': '1100001' }), 413],
    [req({ image: 'x'.repeat(1050001) }), 413],
    [new Request('https://surfare.example/api/image-assess', { method: 'POST', body: '{' }), 400],
    [new Request('https://surfare.example/api/image-assess', { method: 'DELETE' }), 405],
  ]) {
    const response = await imageCheck(request, env, () =>
      assert.fail('Invalid request reached AI'),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('free image requests send bounded inline data to a fixed provider and return validated review', async () => {
  const response = await imageCheck(req(), env, async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'openrouter/free');
    assert.equal(payload.response_format.json_schema.strict, true);
    assert.equal(payload.messages[1].content[1].image_url.url, image);
    assert.match(payload.messages[1].content[0].text, /Do NOT read or invent text/);
    assert(Object.values(payload.provider.max_price).every((price) => price === 0));
    assert.equal(payload.provider.sort, 'latency');
    return provider(review);
  });
  const data = await response.json();
  assert.equal(data.status, 'completed');
  assert.equal(data.model, 'test/vision:free');
  assert.deepEqual(data.analysis, emptyAnalysis);
});

test('visible scam text receives grounded safety findings independently of image origin', async () => {
  const value = {
    ...review,
    extractedText: 'Send your OTP now.',
    analysis: {
      level: 'High risk',
      summary: 'This asks for a secret code.',
      recommendation: 'Do not share your OTP.',
      findings: [
        {
          kind: 'secret',
          level: 'High risk',
          quote: 'Send your OTP',
          explanation: 'The sender asks for a private login code.',
        },
      ],
    },
  };
  const response = await imageCheck(req({ mode: 'content' }), env, async () => provider(value));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis.level, 'High risk');
  const wrongMode = await imageCheck(req(), env, async () => provider(value));
  assert.equal(wrongMode.status, 502);
});

test('invented quotes, unsupported origin labels, empty evidence and no-text safety verdicts are rejected', () => {
  for (const value of [
    { ...review, origin: { ...review.origin, label: '99% AI' } },
    { ...review, origin: { ...review.origin, label: 'AI-like visual cues' } },
    { ...review, analysis: { ...emptyAnalysis, level: 'Low risk' } },
    {
      ...review,
      extractedText: 'hello',
      analysis: {
        ...emptyAnalysis,
        level: 'High risk',
        findings: [
          {
            kind: 'scam',
            level: 'High risk',
            quote: 'not in image',
            explanation: 'Invented evidence.',
          },
        ],
      },
    },
  ])
    assert.throws(() => validateImageAssessment(value));
});

test('provider failure, incomplete output and timeouts stay unavailable without retry', async () => {
  for (const [fetcher, status] of [
    [async () => Response.json({ error: 'busy' }, { status: 429 }), 429],
    [async () => Response.json({ choices: [{ finish_reason: 'length' }] }), 502],
    [async () => provider({ invalid: true }), 502],
    [
      async () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
      504,
    ],
  ]) {
    let calls = 0;
    const response = await imageCheck(req(), env, (...args) => {
      calls++;
      return fetcher(...args);
    });
    assert.equal(response.status, status);
    assert.equal((await response.json()).status, 'unavailable');
    assert.equal(calls, 1);
  }
});

test('creation metadata takes priority and visual confidence is never a numeric authenticity claim', () => {
  const metadata = { findings: [{ code: 'ai-declaration', message: 'AI creation declared.' }] };
  assert.equal(
    imageOriginVerdict(metadata, { status: 'completed', origin: { label: 'No clear AI cues' } })
      .label,
    'AI-generated',
  );
  assert.equal(imageOriginVerdict(metadata).confidence, 'High');
  assert.equal(
    imageOriginVerdict({ findings: [{ code: 'ai-tool', message: 'Tool named.' }] }).label,
    'AI-generated or edited',
  );
  for (const [label, expected] of [
    ['AI-like visual cues', 'Likely AI-generated'],
    ['No clear AI cues', 'No clear AI signs'],
    ['Uncertain', 'Origin unclear'],
  ]) {
    const verdict = imageOriginVerdict(null, {
      status: 'completed',
      origin: { label, summary: 'Evidence review.', observations: ['Specific observed clue.'] },
    });
    assert.equal(verdict.label, expected);
    assert(['Medium', 'Low'].includes(verdict.confidence));
    assert.match(verdict.limitation, /not a forensic detector/);
  }
  assert.equal(imageOriginVerdict(null, { status: 'unavailable' }).confidence, 'Not measured');
});

test('Cloudflare and Vercel both expose the image route without credentials', async () => {
  const response = await worker.fetch(new Request('https://surfare.example/api/image-assess'), {});
  assert.equal((await response.json()).configured, false);
  let data, status;
  await adapter(
    { method: 'GET', url: '/api/image-assess', headers: { host: 'surfare.example' } },
    {
      statusCode: 200,
      setHeader() {},
      end(value) {
        data = JSON.parse(value);
        status = this.statusCode;
      },
    },
  );
  assert.equal(status, 200);
  assert.equal(typeof data.configured, 'boolean');
  assert(!JSON.stringify(data).includes('API_KEY'));
});
