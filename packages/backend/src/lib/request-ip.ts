import type { Request } from 'express';

/** Client IP for rate limiting / blocking (trust X-Forwarded-For first hop when behind proxy). */
export function getClientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    const first = xf.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }
  if (Array.isArray(xf) && xf[0]) {
    return normalizeIp(xf[0].split(',')[0]?.trim() || xf[0]);
  }
  const raw = req.socket?.remoteAddress || req.ip || '';
  return normalizeIp(raw);
}

export function normalizeIp(ip: string): string {
  if (!ip) return '';
  let s = ip.trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  return s;
}
