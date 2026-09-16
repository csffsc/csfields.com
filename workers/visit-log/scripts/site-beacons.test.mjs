import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const workflow = readFileSync(path.join(ROOT, '.github/workflows/static.yml'), 'utf8');

describe('site beacons', () => {
  it('sends first-party /e beacons with query names only', () => {
    expect(html).toMatch(/navigator\.sendBeacon/);
    expect(html).toMatch(/\/e\?n=/);
    expect(html).toMatch(/n=view|ping\('view'\)|beacon\('view'\)/);
    expect(html).toMatch(/linkedin/);
    expect(html).toMatch(/mailto/);
    expect(html).toMatch(/['"]bio['"]/);
    expect(html).toMatch(/dwell/);
  });

  it('has no third-party pixels', () => {
    expect(html).not.toMatch(/google-analytics|gtag\(|googletagmanager|plausible\.io|analytics\.js/i);
  });

  it('deploys favicon.svg with the Pages workflow', () => {
    expect(workflow).toMatch(/favicon\.svg/);
  });
});
