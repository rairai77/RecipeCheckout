import type { Browser } from 'puppeteer-core';

/** Timings for the last launch, so the endpoint can report cold vs warm. */
export interface LaunchTimings {
  coldInstance: boolean;
  importMs: number;
  executablePathMs: number;
  launchMs: number;
}

let instanceUsed = false;

export const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

export async function launch(): Promise<{ browser: Browser; timings: LaunchTimings }> {
  const coldInstance = !instanceUsed;
  instanceUsed = true;
  const t0 = performance.now();
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ]);
  const t1 = performance.now();
  // first call per instance decompresses chromium.br (~67 MB) into /tmp; later calls reuse it
  const executablePath = await chromium.executablePath();
  const t2 = performance.now();
  const browser = await puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    defaultViewport: { width: 1366, height: 900 },
    executablePath,
    headless: 'shell',
  });
  const t3 = performance.now();
  return {
    browser,
    timings: {
      coldInstance,
      importMs: Math.round(t1 - t0),
      executablePathMs: Math.round(t2 - t1),
      launchMs: Math.round(t3 - t2),
    },
  };
}
