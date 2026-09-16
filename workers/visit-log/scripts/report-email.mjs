import nodemailer from 'nodemailer';
import { escapeHtml } from './people-filter.mjs';

const REQUIRED = ['q_email', 'q_smtp_server', 'q_smtp_port', 'q_smtp_token'];

export function assertMailSecrets() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing Infisical mail secrets: ${missing.join(', ')}`);
  }
}

/** @param {number} n @param {number} total */
function pct(n, total) {
  if (!total) return '0%';
  return `${Math.round((Number(n) / total) * 100)}%`;
}

function formatDelta(n) {
  const value = Number(n) || 0;
  if (value > 0) return `+${value}`;
  return String(value);
}

function rowsOrEmpty(html, colspan) {
  return html || `<tr><td colspan="${colspan}">No rows</td></tr>`;
}

/**
 * @param {{ periodLabel: string, runDate: string, data: object, canvasName: string }} opts
 */
export function buildHtml({ periodLabel, runDate, data, canvasName }) {
  const people = data.people ?? {};
  const footnote = data.footnote2xx ?? {};
  const noise = data.noise ?? {};
  const repeats = data.repeats ?? {};
  const unique = Number(people.unique ?? 0);

  const countryRows = (data.byCountryAsOrg ?? [])
    .slice(0, 8)
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.country) || '(blank)'}</td><td>${escapeHtml(r.as_org) || '(blank)'}</td><td align="right">${r.unique}</td><td align="right">${r.hits}</td></tr>`
    )
    .join('');

  const deviceRows = (data.byDevice ?? [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.family)}</td><td align="right">${r.n}</td><td align="right">${pct(r.n, unique)}</td></tr>`
    )
    .join('');

  const hourRows = (data.byHourEt ?? [])
    .map(
      (r) =>
        `<tr><td>${String(r.hour).padStart(2, '0')}:00 ET</td><td align="right">${r.n}</td></tr>`
    )
    .join('');

  const referrerRows = (data.byReferrer ?? [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.bucket)}</td><td align="right">${r.n}</td><td align="right">${pct(r.n, unique)}</td></tr>`
    )
    .join('');

  const redirectRows = (data.appendix?.redirects ?? [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.path)}</td><td align="right">${escapeHtml(r.status)}</td><td align="right">${r.n}</td></tr>`
    )
    .join('');

  const faviconRows = (data.appendix?.faviconRobots ?? [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.path)}</td><td align="right">${escapeHtml(r.status)}</td><td align="right">${r.n}</td></tr>`
    )
    .join('');

  const probeRows = (data.appendix?.probes ?? [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.path)}</td><td align="right">${r.n}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #222; max-width: 640px;">
  <p style="color: #666; font-size: 13px;">csfields.com visit log · ${escapeHtml(periodLabel)} report · ${escapeHtml(runDate)}</p>
  <h2 style="font-weight: normal;">People this week</h2>
  <table cellpadding="6" cellspacing="0" border="0">
    <tr><td>People this week</td><td align="right"><strong>${unique}</strong></td></tr>
    <tr><td>Visits (people rows)</td><td align="right">${people.hits ?? 0}</td></tr>
    <tr><td>vs last window</td><td align="right">${people.prevUnique ?? 0} (${formatDelta(people.delta)})</td></tr>
    <tr><td>Returning</td><td align="right">${people.returning ?? 0} (${people.returningPct ?? 0}%)</td></tr>
    <tr><td>New</td><td align="right">${people.newCount ?? 0}</td></tr>
    <tr><td>Repeat hits 1 / 2–4 / 5+</td><td align="right">${repeats.one ?? 0} / ${repeats.twoToFour ?? 0} / ${repeats.fivePlus ?? 0}</td></tr>
    <tr><td>Window</td><td align="right">${escapeHtml(data.bounds?.earliest) || '—'} → ${escapeHtml(data.bounds?.latest) || '—'}</td></tr>
  </table>

  <h3 style="font-weight: normal;">Country × AS org</h3>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Country</th><th align="left">AS org</th><th align="right">People</th><th align="right">Visits</th></tr>
    ${rowsOrEmpty(countryRows, 4)}
  </table>

  <h3 style="font-weight: normal;">Device / hour ET</h3>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Device</th><th align="right">People</th><th align="right">Share</th></tr>
    ${rowsOrEmpty(deviceRows, 3)}
  </table>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 8px;">
    <tr><th align="left">Hour (America/New_York)</th><th align="right">Visits</th></tr>
    ${rowsOrEmpty(hourRows, 2)}
  </table>

  <h3 style="font-weight: normal;">How they arrived</h3>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Referrer</th><th align="right">People</th><th align="right">Share</th></tr>
    ${rowsOrEmpty(referrerRows, 3)}
  </table>

  <h3 style="font-weight: normal;">Noise collapsed</h3>
  <table cellpadding="6" cellspacing="0" border="0">
    <tr><td>www/http redirects</td><td align="right">${noise.redirects ?? 0}</td></tr>
    <tr><td>favicon/robots</td><td align="right">${noise.faviconRobots ?? 0}</td></tr>
    <tr><td>Real probes</td><td align="right">${noise.probes ?? 0}</td></tr>
    <tr><td>Cloud/hosting 2XX dropped from headline</td><td align="right">${noise.cloud2xx ?? 0}</td></tr>
  </table>
  <p style="font-size: 13px; color: #666;">2XX footnote (not the headline): ${footnote.requests ?? 0} 2XX requests from ${footnote.unique_ips ?? 0} IPs (${footnote.human ?? 0} bot_guess=0 / ${footnote.bot ?? 0} bot).</p>

  <h2 style="font-weight: normal; margin-top: 24px;">Appendix — redirects</h2>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Path</th><th align="right">Status</th><th align="right">Count</th></tr>
    ${rowsOrEmpty(redirectRows, 3)}
  </table>
  <h2 style="font-weight: normal; margin-top: 24px;">Appendix — favicon/robots</h2>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Path</th><th align="right">Status</th><th align="right">Count</th></tr>
    ${rowsOrEmpty(faviconRows, 3)}
  </table>
  <h2 style="font-weight: normal; margin-top: 24px;">Appendix — real probes</h2>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Path</th><th align="right">Count</th></tr>
    ${rowsOrEmpty(probeRows, 2)}
  </table>
  <p style="margin-top: 24px; font-size: 13px; color: #666;">
    Full charts and tables: open Cursor canvas <code>${escapeHtml(canvasName)}</code>
  </p>
  <p style="font-size: 13px; color: #888;">— Q<br/>csfields.com traffic intelligence</p>
</body>
</html>`;
}

/**
 * @param {{ subject: string, html: string }} mail
 */
export async function sendReportEmail({ subject, html }) {
  assertMailSecrets();

  const transporter = nodemailer.createTransport({
    host: process.env.q_smtp_server,
    port: Number(process.env.q_smtp_port),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.q_email,
      pass: process.env.q_smtp_token,
    },
  });

  const from = `Q <${process.env.q_email}>`;
  const to = process.env.REPORT_TO ?? process.env.q_email;

  await transporter.sendMail({ from, to, subject, html });
}
