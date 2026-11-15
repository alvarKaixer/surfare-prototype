import { validateFeedback, feedbackPolicy, feedbackRetentionDays } from '../../lib/feedback.js';

function configuration(env) {
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const configured =
    env.FEEDBACK_ENABLED === 'true' &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) &&
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' &&
    env.SUPABASE_SERVICE_ROLE_KEY.length > 20;
  return { configured, url };
}
export async function feedback(request, env, fetcher = fetch) {
  const json = (value, status = 200) =>
    Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  const config = configuration(env);
  if (request.method === 'GET')
    return json({
      configured: config.configured,
      policy: feedbackPolicy,
      retentionDays: feedbackRetentionDays,
    });
  if (!['POST', 'DELETE'].includes(request.method))
    return json({ message: 'Method not allowed.' }, 405);
  if (!config.configured) return json({ message: 'Feedback storage is not connected yet.' }, 503);
  if (
    (request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return json({ message: 'Origin rejected.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ message: 'JSON required.' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 12000)
    return json({ message: 'Feedback is too large.' }, 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json({ message: 'Feedback is too large.' }, 413);
    body = JSON.parse(raw);
    if (request.method === 'POST') body = validateFeedback(body);
    else if (
      !body ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.id) ||
      !/^[a-f0-9]{64}$/.test(body.token) ||
      Object.keys(body).some((k) => !['id', 'token'].includes(k))
    )
      throw Error('Invalid deletion receipt.');
  } catch (error) {
    return json({ message: error.message || 'Invalid feedback.' }, 400);
  }
  try {
    const hash = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.token)),
      ),
    ]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const removing = request.method === 'DELETE';
    const payload = removing
      ? { p_id: body.id, p_hash: hash }
      : {
          p_id: body.id,
          p_hash: hash,
          p_payload: {
            policy: body.policy,
            consent: true,
            kind: body.kind,
            level: body.level,
            correction: body.correction,
            expectedLevel: body.expectedLevel,
            tags: body.tags,
            excerpt: body.excerpt,
            contentConsent: body.contentConsent,
          },
        };
    const response = await fetcher(
      config.url + '/rest/v1/rpc/' + (removing ? 'withdraw_feedback' : 'submit_feedback'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      return json(
        {
          message:
            'Feedback storage is unavailable or its submission limit was reached. Please try later.',
        },
        503,
      );
    const accepted = await response.json();
    if (accepted !== true)
      return json({ message: 'This receipt was withdrawn or is invalid.' }, 409);
    return json({ status: removing ? 'deleted' : 'saved', retentionDays: feedbackRetentionDays });
  } catch {
    return json({ message: 'Could not reach feedback storage. Please try later.' }, 503);
  }
}
