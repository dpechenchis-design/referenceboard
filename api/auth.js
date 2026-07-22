import { send, readBody } from './_store.js';

export default async function handler(req, res){
  // Захист прибрано: вхід дозволено завжди, будь-який пароль (або порожній) підходить.
  return send(res, 200, { ok: true });
}
