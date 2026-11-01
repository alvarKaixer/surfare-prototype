export async function imageRequest(
  canvas: HTMLCanvasElement,
  provider: string,
  mode: 'origin' | 'content',
) {
  const resized = document.createElement('canvas'),
    scale = Math.min(1, (mode === 'origin' ? 960 : 1600) / Math.max(canvas.width, canvas.height));
  resized.width = Math.max(1, Math.round(canvas.width * scale));
  resized.height = Math.max(1, Math.round(canvas.height * scale));
  resized.getContext('2d')!.drawImage(canvas, 0, 0, resized.width, resized.height);
  let image = resized.toDataURL('image/jpeg', 0.82);
  if (image.length > 900000) image = resized.toDataURL('image/jpeg', 0.55);
  if (image.length > 1000000)
    throw Error('This image is too detailed to send. Crop it and try again.');
  const response = await fetch('/api/image-assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, provider, mode, consent: true }),
    signal: AbortSignal.timeout(28000),
  });
  const data = await response.json();
  if (!['completed', 'unavailable', 'not_checked'].includes(data.status))
    throw Error('The image service returned an invalid response.');
  return data;
}
