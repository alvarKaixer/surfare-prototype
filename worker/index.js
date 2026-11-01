import { verify } from '../server/services/reputation.js';
import { semanticCheck } from '../server/services/semantic.js';
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/verify') return verify(request, env);
    if (new URL(request.url).pathname === '/api/assess') return semanticCheck(request, env);
    if (new URL(request.url).pathname.startsWith('/api/'))
      return Response.json({ error: 'Not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
