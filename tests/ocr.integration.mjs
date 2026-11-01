import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createWorker } from 'tesseract.js';
import { recognizeImage } from '../lib/ocr.js';
import { characterErrorRate } from '../lib/evaluation.js';
import { assessContent } from '../lib/content-assessment.js';

// Opt-in real-engine smoke test: node --test tests/ocr.integration.mjs
// Run npm run build first to prepare the local language data. No network is needed.
// Synthetic screenshots do not measure accuracy on actual camera photographs.
const fixture = resolve('tests/fixtures/ocr'),
  cache = await mkdtemp(join(tmpdir(), 'surfare-ocr-'));
const expected = await readFile(join(fixture, 'expected.txt'), 'utf8');
let worker;
try {
  worker = await createWorker('eng', 1, { langPath: resolve('public/ocr'), cachePath: cache });
  for (const name of ['screenshot', 'dark-screen', 'rotated-90', 'rotated-180', 'rotated-270']) {
    await test('real OCR reads synthetic ' + name, async () => {
      const angle = Number(name.split('-')[1]) || 0,
        corrections = [];
      const start = performance.now(),
        data = await recognizeImage(worker, join(fixture, name + '.png'), {
          checkOrientation: true,
          prepareRotation: async (turn) => {
            const rotated = (angle + turn * 90) % 360;
            return join(fixture, rotated ? 'rotated-' + rotated + '.png' : 'screenshot.png');
          },
          onOrientation: (degrees) => corrections.push(degrees),
        });
      const cer = characterErrorRate(expected, data.text);
      console.log(
        JSON.stringify({
          fixture: name,
          confidence: data.confidence,
          characterErrorRate: cer,
          corrections,
          elapsedMs: Math.round(performance.now() - start),
          text: data.text.trim(),
        }),
      );
      assert(
        cer < 0.08,
        'Expected <8% character error on a clean synthetic screenshot, got ' +
          (cer * 100).toFixed(1) +
          '%',
      );
      assert.match(data.text, /OTP/i);
      assert.match(data.text, /verify-account\.example/);
    });
  }
  await test('real OCR feeds Tagalog violence into the same high-risk assessment', async () => {
    const text = await readFile('tests/fixtures/content/tagalog-threat.txt', 'utf8');
    const data = await recognizeImage(worker, resolve('tests/fixtures/content/tagalog-threat.png'));
    const cer = characterErrorRate(text, data.text),
      result = assessContent({ text: data.text, kind: 'image', uncertain: data.confidence < 65 });
    assert(cer < 0.08);
    assert.equal(result.level, 'High risk');
    assert(
      result.indicators.some(
        (i) => i.id === 'violence' && i.evidence.some((e) => /papatayin kita/i.test(e.text)),
      ),
    );
    console.log(
      JSON.stringify({
        fixture: 'Tagalog threat screenshot',
        characterErrorRate: cer,
        level: result.level,
      }),
    );
  });
} finally {
  await worker?.terminate();
  await unlink(join(cache, 'eng.traineddata')).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await rmdir(cache);
}
