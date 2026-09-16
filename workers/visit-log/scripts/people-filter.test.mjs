import { describe, it, expect } from 'vitest';
import {
  isCloudAsOrg,
  deviceFamily,
  referrerBucket,
  escapeHtml,
  hourInEastern,
} from './people-filter.mjs';

describe('isCloudAsOrg', () => {
  it.each([
    'Amazon.com',
    'AMAZON-02',
    'AWS',
    'Google LLC',
    'GOOGLE',
    'Microsoft Corporation',
    'Azure',
    'DigitalOcean, LLC',
    'Tencent Cloud',
    'Alibaba',
    'OVH SAS',
    'Hetzner Online GmbH',
    'Linode',
    'Akamai Technologies',
    'Oracle Cloud',
    'Vultr Holdings',
    'Leaseweb',
    'Fastly',
    'GitHub, Inc.',
    'Hostinger',
    'M247',
    'Datacamp Limited',
    'Choopa, LLC',
  ])('drops cloud/hosting AS org %s', (asOrg) => {
    expect(isCloudAsOrg(asOrg)).toBe(true);
  });

  it.each(['Comcast Cable', 'Verizon Business', 'AT&T Services', 'T-Mobile USA', ''])(
    'keeps residential or empty AS org %s',
    (asOrg) => {
      expect(isCloudAsOrg(asOrg)).toBe(false);
    }
  );

  it('is case-insensitive', () => {
    expect(isCloudAsOrg('digitalocean, llc')).toBe(true);
    expect(isCloudAsOrg('HETZNER ONLINE')).toBe(true);
  });

  it('treats null and undefined as not cloud', () => {
    expect(isCloudAsOrg(null)).toBe(false);
    expect(isCloudAsOrg(undefined)).toBe(false);
  });
});

describe('deviceFamily', () => {
  it('detects iPhone', () => {
    expect(
      deviceFamily(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe('iPhone');
  });

  it('detects iPad', () => {
    expect(
      deviceFamily(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe('iPad');
  });

  it('detects Android', () => {
    expect(
      deviceFamily(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
      )
    ).toBe('Android');
  });

  it('detects Mac', () => {
    expect(
      deviceFamily(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
      )
    ).toBe('Mac');
  });

  it('detects Windows', () => {
    expect(
      deviceFamily(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe('Windows');
  });

  it('detects Chrome OS before generic Linux', () => {
    expect(
      deviceFamily(
        'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe('Chrome OS');
  });

  it('detects Linux', () => {
    expect(
      deviceFamily(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe('Linux');
  });

  it('returns Unknown for empty UA and Other for unmatched', () => {
    expect(deviceFamily('')).toBe('Unknown');
    expect(deviceFamily(null)).toBe('Unknown');
    expect(deviceFamily('Wget/1.21')).toBe('Other');
  });
});

describe('referrerBucket', () => {
  it('buckets missing referrers as none', () => {
    expect(referrerBucket('')).toBe('none');
    expect(referrerBucket(null)).toBe('none');
    expect(referrerBucket(undefined)).toBe('none');
  });

  it('buckets self hosts', () => {
    expect(referrerBucket('https://csfields.com/')).toBe('self');
    expect(referrerBucket('https://www.csfields.com/')).toBe('self');
  });

  it('buckets Google search hosts', () => {
    expect(referrerBucket('https://www.google.com/')).toBe('Google');
    expect(referrerBucket('https://google.com/url?q=x')).toBe('Google');
  });

  it('buckets everything else as other', () => {
    expect(referrerBucket('https://news.ycombinator.com/')).toBe('other');
    expect(referrerBucket('not a url')).toBe('other');
  });
});

describe('escapeHtml', () => {
  it('escapes markup in paths and labels', () => {
    expect(escapeHtml(`<script>alert(1)</script>`)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(escapeHtml(`US & "Azure"`)).toBe('US &amp; &quot;Azure&quot;');
    expect(escapeHtml(`O'Reilly`)).toBe('O&#39;Reilly');
  });

  it('stringifies nullish as empty', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('hourInEastern', () => {
  it('uses America/New_York, not a fixed UTC-5 offset', () => {
    // 16:00 UTC is 12:00 EDT in September (UTC-4), not 11:00 from a -5 hours hack
    expect(hourInEastern('2026-09-16T16:00:00.000Z')).toBe(12);
    // 16:00 UTC is 11:00 EST in January (UTC-5)
    expect(hourInEastern('2026-01-15T16:00:00.000Z')).toBe(11);
  });

  it('parses SQLite UTC datetime strings', () => {
    expect(hourInEastern('2026-09-16 16:00:00')).toBe(12);
  });
});
