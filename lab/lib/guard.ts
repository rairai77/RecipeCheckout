import { createHash, timingSafeEqual } from 'node:crypto';

/** Every lab endpoint needs `x-lab-token` to match the LAB_TOKEN project env var. */
export function authorized(request: Request): boolean {
  const expected = process.env.LAB_TOKEN;
  const got = request.headers.get('x-lab-token');
  if (!expected || expected.length < 24 || !got) return false;
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(got).digest();
  return timingSafeEqual(a, b);
}

export const MAX_BODY_CHARS = 150_000;
export const MAX_RESPONSE_CHARS = 400_000;

export function capped(s: string, n = MAX_BODY_CHARS): string {
  return s.length > n ? `${s.slice(0, n)}\n...[truncated ${s.length - n} chars]` : s;
}

export function json(data: unknown, status = 200): Response {
  let body = JSON.stringify(data);
  if (body.length > MAX_RESPONSE_CHARS) body = JSON.stringify({ error: 'response over cap', chars: body.length });
  return new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** Bot-protection fingerprints visible in headers, cookie names or the body. */
export function botSignals(headers: Headers | Record<string, string>, body: string): string[] {
  const h = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  const all = `${Object.keys(h).join(' ')} ${Object.values(h).join(' ')}`.toLowerCase();
  const b = body.slice(0, 200_000);
  const out = new Set<string>();
  if (/akamai|_abck|bm_sz|ak_bmsc|bm_sv/.test(all) || /Reference #\d+\.\w+/.test(b)) out.add('akamai');
  if (/_px\d|_pxhd|_pxvid|perimeterx|px-captcha/.test(all) || /px-captcha|Press &amp; Hold|Press & Hold|perimeterx/i.test(b)) out.add('perimeterx');
  if (/cf-ray|__cf_bm|cf_clearance|cloudflare/.test(all) || /Just a moment\.\.\.|challenge-platform|cf-chl/i.test(b)) out.add('cloudflare');
  if (/datadome|x-dd-b/.test(all) || /captcha-delivery\.com|datadome/i.test(b)) out.add('datadome');
  if (/incap_ses|visid_incap|x-iinfo/.test(all) || /_Incapsula_Resource/i.test(b)) out.add('imperva');
  if (/x-kpsdk/.test(all) || /kpsdk/i.test(b)) out.add('kasada');
  if (/awselb|x-amzn|cloudfront/.test(all)) out.add('aws-edge');
  if (/Access Denied/i.test(b) && b.length < 5000) out.add('access-denied-page');
  if (/captcha/i.test(b) && b.length < 60_000) out.add('captcha-text');
  return [...out];
}

const KEEP_HEADERS = /^(server|content-type|content-length|location|cache-control|x-cache|via|cf-ray|x-akamai.*|akamai-.*|x-px.*|x-datadome.*|x-dd-b|x-iinfo|x-kpsdk.*|x-amz-cf-pop|x-served-by|retry-after|x-ratelimit.*)$/i;

export function pickHeaders(headers: Headers): { headers: Record<string, string>; cookieNames: string[] } {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) if (KEEP_HEADERS.test(k)) out[k] = v.slice(0, 200);
  const cookies = headers.getSetCookie?.() ?? [];
  return { headers: out, cookieNames: cookies.map((c) => c.split('=')[0].trim()).slice(0, 30) };
}
