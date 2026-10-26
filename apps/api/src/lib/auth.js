import crypto from 'node:crypto';
import { config } from '../config.js';

// SIY-26: admin endpoints need the "x-admin-key" header.
// Hash both sides first so timingSafeEqual always gets equal-length buffers (no length leak).
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const expected = sha256(config.adminKey);

export function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key');
  if (!key || !crypto.timingSafeEqual(sha256(key), expected)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
