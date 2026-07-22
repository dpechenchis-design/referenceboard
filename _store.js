// Shared storage layer. Real mode: Vercel Blob, one fixed blob per key.
// RB_LOCAL_MOCK=1 switches to an in-memory Map for local development.
//
// Operations budget (this is what suspended the store in July 2026): on the
// Hobby plan only 2000 "advanced operations" per month are included, and
// put/list/del all count. The old design spent ~4 per board autosave
// (list on read; put + list + del on write), so a couple of client sessions
// burned the whole month.
//
// Now: writes are a single put() to a deterministic path, reads are a plain
// fetch() of that path's public URL — which is data transfer, not an
// operation. One autosave = 1 advanced op instead of 4, and reads are free.

const MOCK = !!process.env.RB_LOCAL_MOCK;
const PREFIX = 'refboard/';
const mem = new Map();

async function blobApi(){
  return await import('@vercel/blob');
}

// A blob's public URL is derived from the store id, which is embedded in the
// token: vercel_blob_rw_<storeId>_<secret> → <storeid>.public.blob.vercel-storage.com
function publicBase(){
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';
  const storeId = token.split('_')[3] || '';
  if(!storeId) throw new Error('BLOB_READ_WRITE_TOKEN is missing or malformed');
  return 'https://' + storeId.toLowerCase() + '.public.blob.vercel-storage.com/';
}

// key examples: 'clients', 'boards/<token>'
function pathFor(key){ return PREFIX + key + '.json'; }

async function fetchJson(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(res.status === 403) throw new Error('storage suspended');
  if(res.status === 404) return undefined;   // absent, not an error
  if(!res.ok) return undefined;
  return await res.json();
}

// One-time migration: older data lives at versioned paths (<key>/<timestamp>.json).
// This costs one list() and only runs until the key has been written once.
async function readLegacy(key){
  const { list } = await blobApi();
  const { blobs } = await list({ prefix: PREFIX + key + '/', limit: 20 });
  if(!blobs.length) return null;
  blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  const data = await fetchJson(blobs[0].url);
  return data === undefined ? null : data;
}

export async function readJson(key){
  if(MOCK) return mem.get(key) ?? null;
  const data = await fetchJson(publicBase() + pathFor(key));
  if(data !== undefined) return data;
  return await readLegacy(key);
}

export async function writeJson(key, data){
  if(MOCK){ mem.set(key, data); return; }
  const { put } = await blobApi();
  await put(pathFor(key), JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
}

export function isAdmin(req){
  eturn true;
}

export function send(res, code, obj){
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export async function readBody(req){
  if(req.body !== undefined && req.body !== null){
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function query(req){
  return new URL(req.url, 'http://local').searchParams;
}

// Wraps a handler so storage/runtime failures come back as a readable JSON
// error instead of a bare FUNCTION_INVOCATION_FAILED crash page.
export function withErrors(handler){
  return async function(req, res){
    try{
      return await handler(req, res);
    }catch(e){
      const msg = String(e && e.message || e);
      const suspended = /suspended|forbidden|403|store/i.test(msg);
      return send(res, 503, {
        error: suspended
          ? 'Сховище Vercel Blob призупинено: вичерпано місячний ліміт операцій Hobby-плану (2000 advanced operations). Обнуляється на початку нового періоду — Vercel → Usage → Blob.'
          : 'server error: ' + msg
      });
    }
  };
}
