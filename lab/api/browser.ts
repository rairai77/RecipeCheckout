import { launch } from '../lib/browser.js';
import { authorized, json } from '../lib/guard.js';

/**
 * Headless Chromium timing probe: launch @sparticuz/chromium, load example.com, report each phase.
 * Takes no URL. Token-gated.
 */
export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: 'unauthorized' }, 401);
  const t0 = performance.now();
  const { browser, timings } = await launch();
  try {
    const page = await browser.newPage();
    const g0 = performance.now();
    await page.goto('https://example.com/', { waitUntil: 'load', timeout: 20000 });
    const gotoMs = Math.round(performance.now() - g0);
    const title = await page.title();
    const version = await browser.version();
    return json({
      ok: title === 'Example Domain',
      title,
      version,
      ...timings,
      gotoMs,
      totalMs: Math.round(performance.now() - t0),
      region: process.env.VERCEL_REGION,
      memoryMb: Math.round(process.memoryUsage().rss / 1e6),
    });
  } finally {
    await browser.close();
  }
}
