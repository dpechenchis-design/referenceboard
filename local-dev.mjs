// Local development server: static files + real API handlers with in-memory storage.
// Usage: node local-dev.mjs   → http://localhost:4321  (admin password: test123)
process.env.RB_LOCAL_MOCK = '1';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test123';

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = 4321;

const routes = {
  '/api/auth': (await import('./api/auth.js')).default,
  '/api/clients': (await import('./api/clients.js')).default,
  '/api/board': (await import('./api/board.js')).default
};
const MIME = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.css':'text/css'};

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  const handler = routes[path];
  if(handler){
    try{ await handler(req, res); }
    catch(e){
      console.error(e);
      res.statusCode = 500;
      res.end(JSON.stringify({error: String(e.message || e)}));
    }
    return;
  }
  // static: cleanUrls emulation (/board → board.html)
  let file = path === '/' ? '/index.html' : path;
  if(!extname(file)) file += '.html';
  try{
    const buf = await readFile(join(ROOT, file));
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.end(buf);
  }catch(e){
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(PORT, () => console.log('dev server on http://localhost:' + PORT));
