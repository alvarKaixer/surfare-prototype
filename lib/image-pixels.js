// Pure pixel operations used by quality checks and the OCR fallback.
export function measurePixels(data, width, height) {
  const gray = new Float32Array(width * height);
  let light = 0,
    bright = 0;
  for (let p = 0; p < gray.length; p++) {
    const i = p * 4,
      l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = l;
    light += l;
    if (l > 248) bright++;
  }
  let sum = 0,
    squares = 0,
    count = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x,
        v = gray[p - 1] + gray[p + 1] + gray[p - width] + gray[p + width] - 4 * gray[p];
      sum += v;
      squares += v * v;
      count++;
    }
  return {
    brightness: light / gray.length,
    brightFraction: bright / gray.length,
    sharpness: count ? Math.max(0, squares / count - (sum / count) ** 2) : 0,
  };
}

export function enhancePixels(data) {
  const histogram = new Uint32Array(256);
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[l]++;
    light += l;
  }
  const count = data.length / 4;
  let low = 0,
    high = 255,
    total = 0;
  for (let i = 0; i < 256; i++) {
    total += histogram[i];
    if (total >= count * 0.01) {
      low = i;
      break;
    }
  }
  total = 0;
  for (let i = 255; i >= 0; i--) {
    total += histogram[i];
    if (total >= count * 0.01) {
      high = i;
      break;
    }
  }
  const invert = light / count < 115,
    range = Math.max(40, high - low);
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const stretched = Math.max(0, Math.min(255, ((l - low) * 255) / range));
    const v = invert ? 255 - stretched : stretched;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  return data;
}
