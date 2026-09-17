import { describe, it, expect } from 'vitest';
import { parseReportArgs } from './report-period.mjs';

describe('parseReportArgs', () => {
  it('treats --email-only as skip canvas', () => {
    const parsed = parseReportArgs(['weekly', '--email-only']);
    expect(parsed.periodKey).toBe('weekly');
    expect(parsed.emailOnly).toBe(true);
    expect(parsed.noCanvas).toBe(true);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.noEmail).toBe(false);
  });

  it('keeps --dry-run and --no-email independent of canvas', () => {
    const parsed = parseReportArgs(['monthly', '--dry-run', '--no-email']);
    expect(parsed.periodKey).toBe('monthly');
    expect(parsed.dryRun).toBe(true);
    expect(parsed.noEmail).toBe(true);
    expect(parsed.noCanvas).toBe(false);
  });
});
