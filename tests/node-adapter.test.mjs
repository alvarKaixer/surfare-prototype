import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeHandler } from '../server/http-node.js';

async function invoke(req, service, maxBodyBytes = 20) {
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  await createNodeHandler(service, () => ({ configured: true }), {
    maxBodyBytes,
    errorMessage: 'Unavailable.',
  })({ method: 'POST', url: '/api/test', headers: { host: 'surfare.example' }, ...req }, response);
  return response;
}

test('Node adapter bounds parsed bodies by UTF-8 bytes before calling a service', async () => {
  let calls = 0;
  const response = await invoke({ body: '😀'.repeat(6) }, async () => {
    calls++;
    return Response.json({});
  });
  assert.equal(response.statusCode, 413);
  assert.equal(calls, 0);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('Node adapter bounds streamed bodies before calling a service', async () => {
  let calls = 0;
  const req = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(15);
      yield Buffer.alloc(10);
    },
  };
  const response = await invoke(req, async () => {
    calls++;
    return Response.json({});
  });
  assert.equal(response.statusCode, 413);
  assert.equal(calls, 0);
});

test('Node adapter preserves headers, JSON bodies, environment and service status', async () => {
  const response = await invoke(
    {
      body: { text: 'hi' },
      headers: { host: 'surfare.example', origin: 'https://surfare.example' },
    },
    async (request, env) => {
      assert.equal(request.url, 'https://surfare.example/api/test');
      assert.equal(request.headers.get('origin'), 'https://surfare.example');
      assert.deepEqual(await request.json(), { text: 'hi' });
      assert.deepEqual(env, { configured: true });
      return Response.json({ status: 'unavailable' }, { status: 429 });
    },
  );
  assert.equal(response.statusCode, 429);
});

test('Node adapter hides internal errors and does not cache failures', async () => {
  const response = await invoke({ method: 'GET' }, async () => {
    throw Error('Internal details');
  });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { status: 'unavailable', message: 'Unavailable.' });
  assert.equal(response.headers['cache-control'], 'no-store');
});
