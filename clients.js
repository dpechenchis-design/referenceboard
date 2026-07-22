import crypto from 'node:crypto';
import { readJson, writeJson, isAdmin, send, readBody, query, withErrors } from './_store.js';

async function handler(req, res){
  if(!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });

  const clients = (await readJson('clients')) || [];

  if(req.method === 'GET'){
    return send(res, 200, { clients });
  }

  if(req.method === 'POST'){
    let body;
    try{ body = await readBody(req); }
    catch(e){ return send(res, 400, { error: 'bad json' }); }
    const name = String(body.name || '').trim().slice(0, 120);
    if(!name) return send(res, 400, { error: 'name required' });
    const pin = String(body.pin || '').trim().slice(0, 40);
    const client = {
      id: crypto.randomBytes(6).toString('hex'),
      token: crypto.randomBytes(16).toString('hex'),
      name,
      createdAt: new Date().toISOString()
    };
    if(pin) client.pin = pin;
    clients.push(client);
    await writeJson('clients', clients);
    return send(res, 200, { client });
  }

  if(req.method === 'PATCH'){
    let body;
    try{ body = await readBody(req); }
    catch(e){ return send(res, 400, { error: 'bad json' }); }
    const client = clients.find(c => c.id === String(body.id || ''));
    if(!client) return send(res, 404, { error: 'not found' });
    if('pin' in body){
      const pin = String(body.pin || '').trim().slice(0, 40);
      if(pin) client.pin = pin; else delete client.pin;
    }
    if(body.name){
      const name = String(body.name).trim().slice(0, 120);
      if(name) client.name = name;
    }
    await writeJson('clients', clients);
    return send(res, 200, { client });
  }

  if(req.method === 'DELETE'){
    const id = query(req).get('id');
    if(!id) return send(res, 400, { error: 'id required' });
    const next = clients.filter(c => c.id !== id);
    if(next.length === clients.length) return send(res, 404, { error: 'not found' });
    await writeJson('clients', next);
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: 'method not allowed' });
}

export default withErrors(handler);
