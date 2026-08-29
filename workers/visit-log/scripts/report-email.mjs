import nodemailer from 'nodemailer';

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

/**
 * @param {{ periodLabel: string, runDate: string, data: import('./report-query.mjs').fetchReportData extends (...args: any) => infer R ? R : never, canvasName: string }} opts
 */
export function buildHtml({ periodLabel, runDate, data, canvasName }) {
  const t = data.totals;
  const total2xx = Number(t?.requests ?? 0);
  const probeN = Number(data.appendix.probeTotals?.n ?? 0);

  const countryRows = data.byCountry
    .map(
      (r) =>
        `<tr><td>${r.country || '(blank)'}</td><td align="right">${r.n}</td><td align="right">${pct(r.n, total2xx)}</td></tr>`
    )
    .join('');

  const probePathRows = data.appendix.probePaths
    .map((r) => `<tr><td>${r.path}</td><td align="right">${r.n}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, 'Times New Roman', serif; color: #222; max-width: 640px;">
  <p style="color: #666; font-size: 13px;">csfields.com visit log · ${periodLabel} report · ${runDate}</p>
  <h2 style="font-weight: normal;">Traffic summary (2XX only)</h2>
  <table cellpadding="6" cellspacing="0" border="0">
    <tr><td>Successful requests</td><td align="right"><strong>${total2xx}</strong></td></tr>
    <tr><td>Unique IPs</td><td align="right">${t?.unique_ips ?? 0}</td></tr>
    <tr><td>Unique paths</td><td align="right">${t?.unique_paths ?? 0}</td></tr>
    <tr><td>Likely human (bot_guess=0)</td><td align="right">${t?.human ?? 0}</td></tr>
    <tr><td>Bot guess</td><td align="right">${t?.bot ?? 0}</td></tr>
    <tr><td>Window</td><td align="right">${data.bounds?.earliest ?? '—'} → ${data.bounds?.latest ?? '—'}</td></tr>
  </table>
  <h3 style="font-weight: normal;">Top countries (2XX)</h3>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Country</th><th align="right">Requests</th><th align="right">Share</th></tr>
    ${countryRows || '<tr><td colspan="3">No rows</td></tr>'}
  </table>
  <h2 style="font-weight: normal; margin-top: 24px;">Appendix — probes &amp; non-2XX</h2>
  <p style="font-size: 14px;">Separate from 2XX totals. <strong>${probeN}</strong> rows in this window.</p>
  <table cellpadding="4" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><th align="left">Path</th><th align="right">Count</th></tr>
    ${probePathRows || '<tr><td colspan="2">Nothing notable</td></tr>'}
  </table>
  <p style="margin-top: 24px; font-size: 13px; color: #666;">
    Full charts and tables: open Cursor canvas <code>${canvasName}</code>
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
