// Inspect original metadata containers only. This does not classify image pixels,
// authenticate metadata, validate C2PA signatures, or send the image anywhere.
export function inspectImageProvenance(bytes, type) {
  const findings = [],
    notes = [];
  let credentials = false,
    metadataBytes = 0,
    limited = false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const label = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  const add = (code, message) => {
    if (!findings.some((f) => f.code === code)) findings.push({ code, message });
  };
  const scan = (data, key = '') => {
    if (metadataBytes + data.length > 1024 * 1024) {
      limited = true;
      return;
    }
    metadataBytes += data.length;
    const text = decoder.decode(data);
    // Match the XMP field, rather than arbitrary words in descriptions/pixel data.
    const declarations =
      key === 'c2pa'
        ? text.match(/digitalSourceType[\s\S]{0,180}/gi) || []
        : text.match(/(?:[\w-]+:)?DigitalSourceType\b[^>]{0,2000}(?:>|$)(?:[^<]{0,300})/gi) || [];
    if (
      declarations.some((value) =>
        /\b(?:trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia)\b/i.test(value),
      )
    )
      add(
        'ai-declaration',
        'Metadata declares that generative AI was used. This declaration is unverified.',
      );
    const toolFields =
      text.match(
        /(?:[\w-]+:)?(?:CreatorTool|Software)(?:\s*=\s*["'][^"']{0,300}["']|\b[^>]{0,300}>[^<]{0,300})/gi,
      ) || [];
    if (/^(?:software|creator tool)$/i.test(key)) toolFields.push(text);
    if (
      toolFields.some((value) =>
        /\b(?:DALL[- ]?E|Midjourney|Stable Diffusion|ComfyUI|AUTOMATIC1111|InvokeAI|Adobe Firefly|Fooocus|FLUX)\b/i.test(
          value,
        ),
      )
    )
      add(
        'ai-tool',
        'Metadata names an AI creation tool. This does not prove how the image was made.',
      );
    if (key === 'parameters' && /\bSteps:\s*\d+/i.test(text) && /\bSampler:/i.test(text))
      add(
        'generation-settings',
        'Embedded text contains image-generation settings. These settings are unverified.',
      );
    if (
      ['prompt', 'workflow'].includes(key) &&
      /"class_type"\s*:\s*"(?:KSampler|KSamplerAdvanced)"/.test(text)
    )
      add(
        'generation-workflow',
        'Embedded text contains an image-generation workflow. This workflow is unverified.',
      );
  };
  const pngText = (data, international = false) => {
    const separator = data.indexOf(0);
    if (separator < 0 || separator > 79) return;
    const key = decoder.decode(data.subarray(0, separator)).toLowerCase();
    let start = separator + 1;
    if (international) {
      if (start + 2 > data.length) return;
      if (data[start] !== 0) {
        notes.push('Compressed text metadata was not inspected.');
        return;
      }
      if (data[start + 1] !== 0) return;
      start += 2;
      for (let i = 0; i < 2; i++) {
        const end = data.indexOf(0, start);
        if (end < 0) return;
        start = end + 1;
      }
    }
    scan(data.subarray(start), key);
  };
  let malformed = false,
    segments = 0;
  if (type === 'image/png') {
    let offset = 8,
      ended = false;
    while (offset + 12 <= bytes.length && segments++ < 4096) {
      const length = view.getUint32(offset),
        name = label(offset + 4, offset + 8),
        end = offset + 8 + length;
      if (end + 4 > bytes.length) {
        malformed = true;
        break;
      }
      const data = bytes.subarray(offset + 8, end);
      if (name === 'caBX') {
        credentials = true;
        scan(data, 'c2pa');
      } else if (name === 'tEXt') pngText(data);
      else if (name === 'iTXt') pngText(data, true);
      else if (name === 'zTXt') notes.push('Compressed text metadata was not inspected.');
      if (name === 'IEND') {
        ended = true;
        break;
      }
      offset = end + 4;
    }
    if (!ended) malformed = true;
  } else if (type === 'image/jpeg') {
    let offset = 2;
    while (offset + 2 <= bytes.length && segments++ < 4096) {
      if (bytes[offset++] !== 255) {
        malformed = true;
        break;
      }
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break; // Never inspect compressed pixel data.
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) {
        malformed = true;
        break;
      }
      const length = view.getUint16(offset),
        end = offset + length;
      if (length < 2 || end > bytes.length) {
        malformed = true;
        break;
      }
      const data = bytes.subarray(offset + 2, end);
      if (
        marker === 0xe1 &&
        decoder.decode(data.subarray(0, 29)) === 'http://ns.adobe.com/xap/1.0/\0'
      )
        scan(data.subarray(29));
      if (marker === 0xeb && data[0] === 0x4a && data[1] === 0x50) {
        // Inspect declarations in APP11 JUMBF; signatures remain unverified.
        const header = decoder.decode(data.subarray(0, Math.min(1024, data.length)));
        if (header.includes('c2pa')) {
          credentials = true;
          scan(data, 'c2pa');
        }
      }
      offset = end;
    }
  } else if (type === 'image/webp') {
    let offset = 12;
    const declaredEnd = bytes.length >= 12 ? view.getUint32(4, true) + 8 : 0;
    if (declaredEnd > bytes.length) malformed = true;
    while (offset + 8 <= Math.min(bytes.length, declaredEnd) && segments++ < 4096) {
      const name = label(offset, offset + 4),
        length = view.getUint32(offset + 4, true),
        end = offset + 8 + length;
      if (end > Math.min(bytes.length, declaredEnd)) {
        malformed = true;
        break;
      }
      if (name === 'C2PA') {
        credentials = true;
        scan(bytes.subarray(offset + 8, end), 'c2pa');
      } else if (name === 'XMP ') scan(bytes.subarray(offset + 8, end));
      offset = end + (length % 2);
    }
  }
  if (malformed)
    notes.push(
      'Some metadata could not be read because the container was incomplete or malformed.',
    );
  if (limited || segments >= 4096) notes.push('The bounded metadata inspection limit was reached.');
  return {
    status: findings.length ? 'ai-metadata' : credentials ? 'credentials-present' : 'unconfirmed',
    title: findings.length
      ? 'Metadata suggests AI use'
      : credentials
        ? 'Content Credentials marker found'
        : 'Image origin unconfirmed',
    findings,
    credentials,
    notes: [...new Set(notes)],
    limitations: [
      'Metadata can be edited or forged. Content Credentials signatures are not verified by this check.',
      'Screenshots and re-exports can remove original metadata. Missing markers do not establish that an image is real or AI-generated.',
      'This check reads supported metadata in the original file; it does not run a pixel-based AI-image detector or recover missing provenance.',
    ],
  };
}
