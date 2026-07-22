import { readJson, writeJson, isAdmin, send, readBody, query, withErrors } from './_store.js';

const MAX_BYTES = 400_000;

async function handler(req, res){
  const q = query(req);
  const token = String(q.get('token') || '');
  if(!/^[a-f0-9]{16,64}$/.test(token)) return send(res, 404, { error: 'unknown board' });

  const clients = (await readJson('clients')) || [];
  const client = clients.find(c => c.token === token);
  if(!client) return send(res, 404, { error: 'unknown board' });

  // optional per-board PIN; the team (admin key) bypasses it.
  // The pin query param exists for sendBeacon, which cannot set headers.
  const pin = String(client.pin || '').trim();
  if(pin && !isAdmin(req)){
    const provided = String(req.headers['x-board-key'] || q.get('pin') || '').trim();
    if(provided !== pin) return send(res, 401, { error: 'pin required', pinRequired: true });
  }

  if(req.method === 'GET'){
    const state = await readJson('boards/' + token);
    return send(res, 200, { client: { name: client.name }, state });
  }

  if(req.method === 'POST'){
    let body;
    try{ body = await readBody(req); }
    catch(e){ return send(res, 400, { error: 'bad json' }); }
    if(!body || typeof body !== 'object' || !body.refs) return send(res, 400, { error: 'bad state' });
    if(JSON.stringify(body).length > MAX_BYTES) return send(res, 413, { error: 'too large' });
    await writeJson('boards/' + token, body);
    return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
  }

  return send(res, 405, { error: 'method not allowed' });
}

export default withErrors(handler);
