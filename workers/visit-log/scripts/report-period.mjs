#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchReportData } from './report-query.mjs';
import { buildHtml, sendReportEmail } from './report-email.mjs';
import { writeCanvas } from './report-canvas.mjs';

const PERIODS = {
  weekly: { hours: 168, label: 'Weekly' },
  monthly: { hours: 672, label: 'Monthly' },
};

export function parseReportArgs(argv) {
  const periodKey = argv.find((a) => !a.startsWith('--'));
  const emailOnly = argv.includes('--email-only');
  return {
    periodKey,
    dryRun: argv.includes('--dry-run'),
    noEmail: argv.includes('--no-email'),
    emailOnly,
    noCanvas: argv.includes('--no-canvas') || emailOnly,
  };
}

function usage() {
  console.error(
    `usage: report-period.mjs <weekly|monthly> [--dry-run] [--no-email] [--no-canvas] [--email-only]`
  );
  process.exit(1);
}

/**
 * @param {ReturnType<typeof parseReportArgs>} flags
 */
export async function runReport(flags) {
  if (!flags.periodKey || !PERIODS[flags.periodKey]) usage();

  const { hours, label } = PERIODS[flags.periodKey];
  const runDate = new Date().toISOString().slice(0, 10);

  console.log(`Fetching ${label.toLowerCase()} report (${hours}h)…`);
  const data = fetchReportData(hours);

  let canvasName = `visit-log-${flags.periodKey}-${runDate}.canvas.tsx`;
  if (!flags.noCanvas) {
    const canvas = writeCanvas({
      periodSlug: flags.periodKey,
      periodLabel: label,
      runDate,
      hours,
      data,
    });
    canvasName = canvas.name;
    console.log(`Canvas: ${canvas.path}`);
  } else {
    console.log('Canvas skipped (--no-canvas or --email-only).');
  }

  const html = buildHtml({ periodLabel: label, runDate, data, canvasName });
  const subject = `csfields visit log — ${label.toLowerCase()} — ${runDate}`;

  if (flags.dryRun || flags.noEmail) {
    console.log(`Subject: ${subject}`);
    console.log(flags.dryRun ? 'Dry run — email not sent.' : 'Email skipped (--no-email).');
    if (flags.dryRun) {
      console.log(html);
    }
  } else {
    await sendReportEmail({ subject, html });
    console.log(`Email sent from Q via ${process.env.q_email}`);
  }

  console.log('Done.');
  return { subject, html, canvasName, data };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await runReport(parseReportArgs(process.argv.slice(2)));
}
