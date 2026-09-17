import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { persistVisit } from './persist.js';

const sampleVisit = {
  ts: '2026-08-01T12:00:00.000Z',
  ip: '203.0.113.9',
  vid: 'visitor-1',
  method: 'GET',
  url: 'https://csfields.com/',
  path: '/',
  query: '',
  status: 200,
  ua: 'curl/8.0',
  referer: null,
  accept_language: 'en-US',
  cookie: 'theme=night',
  dnt: '1',
  sec_gpc: '1',
  accept: 'text/html',
  content_type: null,
  body_len: 0,
  body: '{"ok":true}',
  country: 'US',
  colo: 'EWR',
  as_org: 'Example ISP',
  tls_version: 'TLSv1.3',
  bot_score: 3,
  verified_bot: 0,
  bot_guess: 1,
  ray: 'abc123-EWR',
};

function insertColumns(sql) {
  const match = String(sql).match(/INSERT INTO visits\s*\(([^)]+)\)/i);
  if (!match) throw new Error(`not an insert: ${sql}`);
  return match[1].split(',').map((part) => part.trim());
}

function boundByName(prepareCall, bindCall, name) {
  const idx = insertColumns(prepareCall[0]).indexOf(name);
  expect(idx).toBeGreaterThanOrEqual(0);
  return bindCall[idx];
}

function expectStoredCore(prepareCall, bindCall) {
  expect(boundByName(prepareCall, bindCall, 'ip')).toBe(sampleVisit.ip);
  expect(boundByName(prepareCall, bindCall, 'cookie')).toBe(sampleVisit.cookie);
  expect(boundByName(prepareCall, bindCall, 'body')).toBe(sampleVisit.body);
}

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
    expectStoredCore(prepare.mock.calls[0], bind.mock.calls[0]);
    expect(boundByName(prepare.mock.calls[0], bind.mock.calls[0], 'vid')).toBe(sampleVisit.vid);
    expect(boundByName(prepare.mock.calls[0], bind.mock.calls[0], 'dnt')).toBe(sampleVisit.dnt);
    expect(boundByName(prepare.mock.calls[0], bind.mock.calls[0], 'sec_gpc')).toBe(
      sampleVisit.sec_gpc
    );
    expect(boundByName(prepare.mock.calls[0], bind.mock.calls[0], 'accept')).toBe(
      sampleVisit.accept
    );
    expect(run).toHaveBeenCalledOnce();
  });

  it('retries without vid when D1 has no vid column and still stores ip, cookie, and body', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('D1_ERROR: no such column: vid'))
      .mockResolvedValueOnce({});
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });

    await persistVisit({ DB: { prepare } }, sampleVisit);

    expect(prepare).toHaveBeenCalledTimes(2);
    expect(insertColumns(prepare.mock.calls[0][0])).toContain('vid');
    expect(insertColumns(prepare.mock.calls[1][0])).not.toContain('vid');
    expect(bind.mock.calls[1]).not.toContain(sampleVisit.vid);
    expectStoredCore(prepare.mock.calls[1], bind.mock.calls[1]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('retries without dnt, sec_gpc, and accept when those columns are missing', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('D1_ERROR: no such column: dnt'))
      .mockRejectedValueOnce(new Error('table visits has no column named sec_gpc'))
      .mockRejectedValueOnce(new Error('no such column: accept'))
      .mockResolvedValueOnce({});
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });

    await persistVisit({ DB: { prepare } }, sampleVisit);

    expect(prepare).toHaveBeenCalledTimes(4);
    const lastCols = insertColumns(prepare.mock.calls[3][0]);
    expect(lastCols).not.toContain('dnt');
    expect(lastCols).not.toContain('sec_gpc');
    expect(lastCols).not.toContain('accept');
    expect(lastCols).toContain('vid');
    expectStoredCore(prepare.mock.calls[3], bind.mock.calls[3]);
  });

  it('skips the vid insert on later rows after D1 reports the column is missing', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('table visits has no column named vid'))
      .mockResolvedValue({});
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const env = { DB: { prepare } };

    await persistVisit(env, sampleVisit);
    await persistVisit(env, sampleVisit);

    expect(prepare).toHaveBeenCalledTimes(3);
    expect(insertColumns(prepare.mock.calls[2][0])).not.toContain('vid');
    expectStoredCore(prepare.mock.calls[2], bind.mock.calls[2]);
  });

  it('does not swallow D1 errors other than a missing optional column', async () => {
    const run = vi.fn().mockRejectedValue(new Error('D1_ERROR: database is locked'));
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });

    await expect(persistVisit({ DB: { prepare } }, sampleVisit)).rejects.toThrow(/locked/);
    expect(prepare).toHaveBeenCalledOnce();
  });
});
