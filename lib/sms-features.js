// Shared by training and browser inference to prevent preprocessing drift.
export function smsFeatures(text) {
  const normalized = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/https?:\/\/\S+|\b\S+\.(?:com|net|org|ph|online|xyz|co|uk)\S*/g, ' urltoken ')
    .replace(/\d+/g, ' numbertoken ');
  const words = normalized.match(/[a-z]+/g) || [];
  const features = new Set(words.map((w) => 'w:' + w));
  for (let i = 1; i < words.length; i++) features.add('b:' + words[i - 1] + ' ' + words[i]);
  return { words, features: [...features] };
}
