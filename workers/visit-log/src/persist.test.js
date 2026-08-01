import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { persistVisit } from './persist.js';

const sampleVisit = {
  ts: '2026-08-01T12:00:00.000Z',
  ip: '203.0.113.9',
  method: 'GET',
  url: 'https://csfields.com/',
  path: '/',
  query: '',
  status: 200,
  ua: 'curl/8.0',
  referer: null,
  accept_language: 'en-US',
  cookie: null,
  content_type: null,
  body_len: 0,
  body: null,
  country: 'US',
  colo: 'EWR',
  as_org: 'Example ISP',
  tls_version: 'TLSv1.3',
  bot_score: 3,
  verified_bot: 0,
  bot_guess: 1,
  ray: 'abc123-EWR',
};

describe('persistVisit', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs visit JSON to Workers Logs', async () => {
    await persistVisit(undefined, sampleVisit);
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify({ type: 'visit', ...sampleVisit })
    );
  });

  it('skips D1 when env or DB is missing', async () => {
    await expect(persistVisit(undefined, sampleVisit)).resolves.toBeUndefined();
    await expect(persistVisit({}, sampleVisit)).resolves.toBeUndefined();
  });

  it('inserts visit into D1 when DB is bound', async () => {
    const run = vi.fn().mockResolvedValue({});
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const env = { DB: { prepare } };

    await persistVisit(env, sampleVisit);

    expect(prepare).toHaveBeenCalledOnce();
    expect(bind).toHaveBeenCalledWith(
      sampleVisit.ts,
      sampleVisit.ip,
      sampleVisit.method,
      sampleVisit.url,
      sampleVisit.path,
      sampleVisit.query,
      sampleVisit.status,
      sampleVisit.ua,
      sampleVisit.referer,
      sampleVisit.accept_language,
      sampleVisit.cookie,
      sampleVisit.content_type,
      sampleVisit.body_len,
      sampleVisit.body,
      sampleVisit.country,
      sampleVisit.colo,
      sampleVisit.as_org,
      sampleVisit.tls_version,
      sampleVisit.bot_score,
      sampleVisit.verified_bot,
      sampleVisit.bot_guess,
      sampleVisit.ray
    );
    expect(run).toHaveBeenCalledOnce();
  });
});
