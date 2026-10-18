import { DESKTOP_UA, launch } from '../lib/browser.js';
import { authorized, botSignals, capped, json, pickHeaders } from '../lib/guard.js';
import { fill, readParams, RETAILERS } from '../lib/retailers.js';

/**
 * Allowlisted retailer probe. GET /api/probe?r=<retailer>&t=<template>&via=fetch|jina|browser&q=&store=&zip=&id=
 * Only URLs from lib/retailers.ts are reachable; token-gated; response size capped.
 */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': DESKTOP_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Chromium";v="153", "Google Chrome";v="153", "Not?A_Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

/** Up to 25 short snippets around plain keywords (alnum/-/_ only), to locate API endpoints and keys in big pages. */
function findSnippets(html: string, find: string | null): { k: string; s: string }[] | undefined {
  if (!find) return undefined;
  const out: { k: string; s: string }[] = [];
  for (const k of find.split(',').filter((w) => /^[\w\-.]{3,40}$/.test(w)).slice(0, 6)) {
    let i = html.indexOf(k);
    let n = 0;
    while (i >= 0 && n < 5 && out.length < 25) {
      out.push({ k, s: html.slice(Math.max(0, i - 200), i + 300) });
      i = html.indexOf(k, i + k.length);
      n++;
    }
  }
  return out;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: 'unauthorized' }, 401);
  const sp = new URL(request.url).searchParams;
  const retailer = RETAILERS[sp.get('r') ?? ''];
  if (!retailer) return json({ error: 'unknown retailer', retailers: Object.keys(RETAILERS) }, 400);
  const tKey = sp.get('t') ?? 'search';
  const template = retailer.templates[tKey];
  if (!template) return json({ error: 'unknown template', templates: Object.keys(retailer.templates) }, 400);
  const params = readParams(sp);
  if (typeof params === 'string') return json({ error: params }, 400);
  const via = sp.get('via') ?? 'fetch';
  const { url, init } = fill(template, params);
  const start = performance.now();
  try {
    if (via === 'fetch') {
      const headers = { ...BROWSER_HEADERS, ...(template.headers ?? {}) };
      if (template.method === 'POST' || /api|redsky/.test(url)) {
        headers.Accept = template.headers?.Accept ?? 'application/json, text/plain, */*';
        headers['Sec-Fetch-Dest'] = 'empty';
        headers['Sec-Fetch-Mode'] = 'cors';
        headers['Sec-Fetch-Site'] = 'same-site';
      }
      const res = await fetch(url, { ...init, headers, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      const picked = pickHeaders(res.headers);
      return json({
        via, url, status: res.status, finalUrl: res.url, ms: Math.round(performance.now() - start),
        ...picked, signals: botSignals(res.headers, body), bodyChars: body.length, body: capped(body),
      });
    }
    if (via === 'jina') {
      if (template.method === 'POST') return json({ error: 'jina mode is GET only' }, 400);
      const fmt = sp.get('fmt') === 'html' ? 'html' : 'markdown';
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { 'X-Return-Format': fmt, 'X-Timeout': '25' },
        signal: AbortSignal.timeout(40000),
      });
      const body = await res.text();
      return json({
        via, url, status: res.status, ms: Math.round(performance.now() - start),
        ...pickHeaders(res.headers), signals: botSignals({}, body), bodyChars: body.length, body: capped(body),
      });
    }
    if (via === 'pagefetch') {
      // Load the retailer's own `home` template first (to pick up its bot-manager cookies/tokens), then call the
      // allowlisted template from inside that page, as the site's own JS would.
      const home = retailer.templates.home ?? retailer.templates.robots;
      if (!home) return json({ error: 'retailer has no home template' }, 400);
      const { browser, timings } = await launch();
      try {
        const page = await browser.newPage();
        await page.setUserAgent(DESKTOP_UA);
        const g0 = performance.now();
        await page.goto(fill(home, params).url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
        await new Promise((r) => setTimeout(r, 4000)); // let the bot-manager script set its token cookie
        const homeMs = Math.round(performance.now() - g0);
        const f0 = performance.now();
        const r = await page.evaluate(
          async (u: string, method: string, headers: Record<string, string>, body: string | null) => {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), 12000);
            try {
              const res = await fetch(u, { method, headers, body: body ?? undefined, credentials: 'include', signal: ctl.signal });
              return { status: res.status, text: await res.text() };
            } catch (e) {
              return { status: 0, text: String(e) };
            } finally {
              clearTimeout(t);
            }
          },
          url,
          template.method ?? 'GET',
          template.headers ?? {},
          typeof init.body === 'string' ? init.body : null,
        );
        const cookies = (await page.cookies()).map((c) => c.name);
        return json({
          via, url, status: r.status, ...timings, homeMs, fetchMs: Math.round(performance.now() - f0),
          ms: Math.round(performance.now() - start), cookieNames: cookies.slice(0, 40),
          signals: botSignals(Object.fromEntries(cookies.map((c) => [c, ''])), r.text), bodyChars: r.text.length, body: capped(r.text),
        });
      } finally {
        await browser.close();
      }
    }
    if (via === 'browser') {
      if (template.method === 'POST') return json({ error: 'browser mode is GET only' }, 400);
      const { browser, timings } = await launch();
      try {
        const page = await browser.newPage();
        await page.setUserAgent(DESKTOP_UA);
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        const xhr: { url: string; status: number; type: string }[] = [];
        const captured: { url: string; status: number; body: string }[] = [];
        page.on('response', async (r) => {
          const rt = r.request().resourceType();
          if (rt !== 'xhr' && rt !== 'fetch') return;
          const u = r.url();
          if (xhr.length < 60) xhr.push({ url: u.slice(0, 400), status: r.status(), type: r.headers()['content-type'] ?? '' });
          if (retailer.capture?.test(u) && captured.length < 5) {
            try {
              const text = await r.text();
              captured.push({ url: u.slice(0, 600), status: r.status(), body: capped(text, 50_000) });
            } catch { /* body unavailable (redirect/preflight) */ }
          }
        });
        const g0 = performance.now();
        const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch((e: Error) => {
          console.error('goto', e.message);
          return null;
        });
        const extraWait = Math.min(Number(sp.get('wait') ?? 0) || 0, 15000);
        if (extraWait > 0) {
          await page.evaluate(() => window.scrollBy(0, 1200)).catch(() => undefined);
          await new Promise((r) => setTimeout(r, extraWait));
        }
        const gotoMs = Math.round(performance.now() - g0);
        const html = await page.content();
        const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
        const cookies = (await page.cookies()).map((c) => c.name);
        return json({
          via, url, status: resp?.status() ?? 0, finalUrl: page.url(), title: await page.title(),
          ...timings, gotoMs, ms: Math.round(performance.now() - start),
          cookieNames: cookies.slice(0, 40), signals: botSignals(Object.fromEntries(cookies.map((c) => [c, ''])), html),
          htmlChars: html.length, text: capped(text, 12_000), html: sp.get('html') === '1' ? capped(html, 120_000) : undefined,
          xhr, captured, found: findSnippets(html, sp.get('find')),
        });
      } finally {
        await browser.close();
      }
    }
    return json({ error: 'via must be fetch, jina or browser' }, 400);
  } catch (err) {
    return json({ via, url, error: (err as Error).message, ms: Math.round(performance.now() - start) }, 502);
  }
}
