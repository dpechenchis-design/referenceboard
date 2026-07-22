import { send, readBody } from './_store.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if(!process.env.ADMIN_PASSWORD){
    return send(res, 500, { error: 'ADMIN_PASSWORD is not set. Add it in Vercel → Settings → Environment Variables and redeploy.' });
  }
  let body;
  try{ body = await readBody(req); }
  catch(e){ return send(res, 400, { error: 'bad json' }); }
  if(body.password === process.env.ADMIN_PASSWORD) return send(res, 200, { ok: true });
  return send(res, 401, { error: 'wrong password' });
}
