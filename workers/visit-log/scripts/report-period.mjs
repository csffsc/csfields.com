#!/usr/bin/env node
import { fetchReportData } from './report-query.mjs';
import { buildHtml, sendReportEmail } from './report-email.mjs';
import { writeCanvas } from './report-canvas.mjs';

const PERIODS = {
  weekly: { hours: 168, label: 'Weekly' },
  monthly: { hours: 672, label: 'Monthly' },
};

function usage() {
  console.error(`usage: report-period.mjs <weekly|monthly> [--dry-run] [--no-email] [--no-canvas]`);
  process.exit(1);
}

const args = process.argv.slice(2);
const periodKey = args.find((a) => !a.startsWith('--'));
if (!periodKey || !PERIODS[periodKey]) usage();

const dryRun = args.includes('--dry-run');
const noEmail = args.includes('--no-email');
const noCanvas = args.includes('--no-canvas');

const { hours, label } = PERIODS[periodKey];
const runDate = new Date().toISOString().slice(0, 10);

console.log(`Fetching ${label.toLowerCase()} report (${hours}h)…`);
const data = fetchReportData(hours);

let canvasName = `visit-log-${periodKey}-${runDate}.canvas.tsx`;
if (!noCanvas) {
  const canvas = writeCanvas({
    periodSlug: periodKey,
    periodLabel: label,
    runDate,
    hours,
    data,
  });
  canvasName = canvas.name;
  console.log(`Canvas: ${canvas.path}`);
}

const html = buildHtml({ periodLabel: label, runDate, data, canvasName });
const subject = `csfields visit log — ${label.toLowerCase()} — ${runDate}`;

if (dryRun || noEmail) {
  console.log(`Subject: ${subject}`);
  console.log(dryRun ? 'Dry run — email not sent.' : 'Email skipped (--no-email).');
} else {
  await sendReportEmail({ subject, html });
  console.log(`Email sent from Q via ${process.env.q_email}`);
}

console.log('Done.');
