import { send, readBody } from './_store.js';

export default async function handler(req, res){
  // Захист прибрано: вхід дозволено завжди.
  return send(res, 200, { ok: true });
}
