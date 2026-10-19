const MAX_BYTES = 2000000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-SPDC-Key',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store'
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function keysMatch(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  const a = given.trim();
  const b = expected.trim();
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/content') return json({ error: 'Not found' }, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (request.method === 'GET') {
      const raw = await env.SITE.get('content');
      if (!raw) return json({ version: 1, empty: true }, 200);
      return new Response(raw, {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (request.method === 'PUT') {
      const expected = env.PUBLISH_KEY || '';
      const given = request.headers.get('X-SPDC-Key') || '';
      if (!expected || !keysMatch(given, expected)) return json({ error: 'Unauthorized' }, 401);
      const text = await request.text();
      if (text.length > MAX_BYTES) return json({ error: 'Content is too large to publish.' }, 413);
      let data;
      try { data = JSON.parse(text); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Invalid content' }, 400);
      delete data.members;
      delete data.currentUser;
      delete data.givingHistory;
      delete data.newsletterSubs;
      data.version = 1;
      data.updatedAt = new Date().toISOString();
      const stored = JSON.stringify(data);
      await env.SITE.put('content', stored);
      return json({ ok: true, updatedAt: data.updatedAt }, 200);
    }

    return json({ error: 'Method not allowed' }, 405);
  }
};
