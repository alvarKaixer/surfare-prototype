export function needsAiBackup(local, { enabled, configured, online }) {
  return !!(
    enabled &&
    configured &&
    online &&
    (local?.level === 'Insufficient evidence' || local?.level === 'Suspicious') &&
    local.sourceText?.trim()
  );
}
