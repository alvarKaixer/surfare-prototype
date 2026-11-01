let loading: Promise<typeof import('../../lib/content-assessment.js')> | undefined;

// The SMS model and domain database load only when a check is needed.
export function loadLocalAssessment() {
  loading ??= import('../../lib/content-assessment.js').catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
