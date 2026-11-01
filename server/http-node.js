import { Buffer } from 'node:buffer';

function json(body, status) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function send(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  return response.text().then((body) => res.end(body));
}

// Vercel-specific request conversion stays outside the shared Web Request services.
export function createNodeHandler(service, environment, { maxBodyBytes, errorMessage }) {
  return async function handler(req, res) {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers || {})) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      let body;
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.body !== undefined) {
          body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          if (body !== undefined && Buffer.byteLength(body) > maxBodyBytes) {
            return await send(
              res,
              json({ status: 'unavailable', message: 'Input is too large.' }, 413),
            );
          }
        } else {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += bytes.length;
            if (size > maxBodyBytes) {
              return await send(
                res,
                json({ status: 'unavailable', message: 'Input is too large.' }, 413),
              );
            }
            chunks.push(bytes);
          }
          body = Buffer.concat(chunks).toString('utf8');
        }
      }
      const origin = 'https://' + (req.headers?.host || 'localhost');
      const request = new Request(new URL(req.url || '/', origin), {
        method: req.method,
        headers,
        body,
      });
      return await send(res, await service(request, environment()));
    } catch {
      return await send(res, json({ status: 'unavailable', message: errorMessage }, 500));
    }
  };
}
