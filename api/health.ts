import { getToken } from '../lib/server/kroger';
import { json } from '../lib/server/http';

export async function GET(): Promise<Response> {
  let kroger = 'ok';
  try {
    await getToken();
  } catch (err) {
    kroger = (err as Error).message;
  }
  return json({ ok: true, kroger, llm: process.env.OR_KEY ? (process.env.LLM_MOCK === '1' ? 'mock' : 'configured') : 'missing' });
}
