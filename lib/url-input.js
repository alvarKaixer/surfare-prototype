export function normalizeUrl(value) {
  let s = value
    .trim()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\[\.\]|\(\.\)/g, '.')
    .replace(/^hxxp/i, 'http');
  if (!/^[a-z][a-z\d+.-]*:/i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  if (
    !['http:', 'https:'].includes(u.protocol) ||
    (!u.hostname.includes('.') && !u.hostname.includes(':'))
  )
    throw Error('Enter a complete HTTP or HTTPS website address.');
  return u;
}
