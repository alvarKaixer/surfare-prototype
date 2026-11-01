import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectImageProvenance } from '../lib/image-provenance.js';

const encoder = new TextEncoder(),
  encode = (text) => encoder.encode(text);
const join = (...parts) => new Uint8Array(parts.flatMap((p) => [...p]));
const u32 = (value, little = false) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, value, little);
  return b;
};
const pngChunk = (type, data) => join(u32(data.length), encode(type), data, new Uint8Array(4));
const png = (...chunks) =>
  join(
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ...chunks,
    pngChunk('IEND', new Uint8Array()),
  );
const xmp =
  '<x:xmpmeta><rdf:Description iptcExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/></x:xmpmeta>';
const jpegSegment = (marker, data) =>
  join(new Uint8Array([255, marker, (data.length + 2) >> 8, (data.length + 2) & 255]), data);
const jpeg = (...segments) =>
  join(new Uint8Array([255, 216]), ...segments, new Uint8Array([255, 217]));
const webpChunk = (name, data) =>
  join(
    encode(name),
    u32(data.length, true),
    data,
    data.length % 2 ? new Uint8Array(1) : new Uint8Array(),
  );
const webp = (...chunks) => {
  const data = join(encode('WEBP'), ...chunks);
  return join(encode('RIFF'), u32(data.length, true), data);
};

test('plain original screenshot remains unconfirmed, never authentic or AI-free', () => {
  const result = inspectImageProvenance(
    readFileSync('tests/fixtures/ocr/screenshot.png'),
    'image/png',
  );
  assert.equal(result.status, 'unconfirmed');
  assert.equal(result.findings.length, 0);
  assert.equal(result.credentials, false);
  assert(result.limitations.some((l) => l.includes('Screenshots')));
});
test('uncompressed PNG XMP declaration is an unverified metadata signal', () => {
  const data = png(
    pngChunk(
      'iTXt',
      join(encode('XML:com.adobe.xmp\0'), new Uint8Array([0, 0, 0, 0]), encode(xmp)),
    ),
  );
  const result = inspectImageProvenance(data, 'image/png');
  assert.equal(result.status, 'ai-metadata');
  assert.equal(result.findings[0].code, 'ai-declaration');
  assert.match(result.findings[0].message, /unverified/);
});
test('PNG generation settings are detected only in the corresponding metadata field', () => {
  const result = inspectImageProvenance(
    png(pngChunk('tEXt', encode('parameters\0A landscape\nSteps: 20, Sampler: Euler, Seed: 42'))),
    'image/png',
  );
  assert(result.findings.some((f) => f.code === 'generation-settings'));
  assert.equal(
    inspectImageProvenance(
      png(pngChunk('tEXt', encode('Description\0Steps: 20, Sampler: Euler'))),
      'image/png',
    ).status,
    'unconfirmed',
  );
});
test('C2PA containers are presence markers, not proof of AI or valid signatures', () => {
  for (const [data, type] of [
    [png(pngChunk('caBX', encode('manifest'))), 'image/png'],
    [webp(webpChunk('C2PA', encode('manifest'))), 'image/webp'],
    [jpeg(jpegSegment(0xeb, encode('JP\0\x01\0\0\0\x01jumb\0jumdc2pa'))), 'image/jpeg'],
  ]) {
    const r = inspectImageProvenance(data, type);
    assert.equal(r.status, 'credentials-present');
    assert.equal(r.findings.length, 0);
    assert(r.credentials);
    assert(r.limitations[0].includes('not verified'));
  }
});
test('JPEG and WebP XMP fields are checked before conversion to a canvas', () => {
  for (const [data, type] of [
    [jpeg(jpegSegment(0xe1, encode('http://ns.adobe.com/xap/1.0/\0' + xmp))), 'image/jpeg'],
    [webp(webpChunk('XMP ', encode(xmp))), 'image/webp'],
  ])
    assert.equal(inspectImageProvenance(data, type).status, 'ai-metadata');
});
test('a generator name in a description does not establish AI use', () => {
  const data = png(
    pngChunk(
      'iTXt',
      join(
        encode('XML:com.adobe.xmp\0'),
        new Uint8Array([0, 0, 0, 0]),
        encode(
          '<dc:description>Article about Midjourney, trainedAlgorithmicMedia and c2pa</dc:description>',
        ),
      ),
    ),
  );
  assert.equal(inspectImageProvenance(data, 'image/png').status, 'unconfirmed');
  const tool = png(pngChunk('tEXt', encode('Software\0ComfyUI')));
  assert.equal(inspectImageProvenance(tool, 'image/png').status, 'ai-metadata');
});
test('pixel chunks are never searched for AI or C2PA strings', () => {
  const data = encode(xmp + 'c2pa ComfyUI');
  assert.equal(
    inspectImageProvenance(png(pngChunk('IDAT', data)), 'image/png').status,
    'unconfirmed',
  );
  assert.equal(
    inspectImageProvenance(webp(webpChunk('VP8 ', data)), 'image/webp').status,
    'unconfirmed',
  );
  const image = join(new Uint8Array([255, 216, 255, 218]), data);
  assert.equal(inspectImageProvenance(image, 'image/jpeg').status, 'unconfirmed');
});
test('truncated metadata and oversized chunks remain bounded and unconfirmed', () => {
  const broken = png(pngChunk('tEXt', encode('Software\0ComfyUI'))).slice(0, 18);
  const r = inspectImageProvenance(broken, 'image/png');
  assert.equal(r.status, 'unconfirmed');
  assert(r.notes.some((n) => n.includes('malformed')));
  const huge = png(pngChunk('tEXt', join(encode('Software\0'), new Uint8Array(1024 * 1024 + 1))));
  const limited = inspectImageProvenance(huge, 'image/png');
  assert.equal(limited.status, 'unconfirmed');
  assert(limited.notes.some((n) => n.includes('limit')));
});
test('compressed metadata is explicitly left unconfirmed', () => {
  const result = inspectImageProvenance(
    png(pngChunk('zTXt', encode('parameters\0compressed'))),
    'image/png',
  );
  assert.equal(result.status, 'unconfirmed');
  assert(result.notes.some((n) => n.includes('Compressed')));
});
