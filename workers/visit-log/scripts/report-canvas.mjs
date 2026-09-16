import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Default: ~/.cursor/projects/<workspace-slug>/canvases (IDE preview location). */
function defaultCanvasDir() {
  if (process.env.VISIT_LOG_CANVAS_DIR) {
    return process.env.VISIT_LOG_CANVAS_DIR;
  }

  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (!home) {
    return path.join(REPO_ROOT, 'canvases');
  }

  const parts = REPO_ROOT.split(path.sep);
  const usersIdx = parts.indexOf('Users');
  if (usersIdx >= 0) {
    const slug = parts.slice(usersIdx).join('-').replace(/\./g, '-');
    const cursorCanvasDir = path.join(home, '.cursor', 'projects', slug, 'canvases');
    if (fs.existsSync(path.dirname(cursorCanvasDir))) {
      return cursorCanvasDir;
    }
  }

  return path.join(REPO_ROOT, 'canvases');
}

function js(value) {
  return JSON.stringify(value, null, 2);
}

/**
 * @param {{ periodSlug: string, periodLabel: string, runDate: string, hours: number, data: object }} opts
 * @returns {string}
 */
export function renderCanvasSource({ periodSlug, periodLabel, runDate, hours, data }) {
  const people = data.people ?? {};
  const titleSuffix = periodSlug.charAt(0).toUpperCase() + periodSlug.slice(1);

  return `import {
  Stack, H1, H2, Text, Divider, Stat, Table, Callout,
} from "cursor/canvas";

const PERIOD = ${js(periodLabel)};
const HOURS = ${hours};
const RUN_DATE = ${js(runDate)};
const BOUNDS = ${js(data.bounds ?? {})};
const PEOPLE = ${js(people)};
const FOOTNOTE_2XX = ${js(data.footnote2xx ?? {})};
const BY_COUNTRY_AS = ${js(data.byCountryAsOrg ?? [])};
const BY_DEVICE = ${js(data.byDevice ?? [])};
const BY_REFERRER = ${js(data.byReferrer ?? [])};
const BY_HOUR_ET = ${js(data.byHourEt ?? [])};
const REPEATS = ${js(data.repeats ?? {})};
const EVENTS = ${js(data.events ?? {})};
const NOISE = ${js(data.noise ?? {})};
const REDIRECTS = ${js(data.appendix?.redirects ?? [])};
const FAVICON_ROBOTS = ${js(data.appendix?.faviconRobots ?? [])};
const PROBES = ${js(data.appendix?.probes ?? [])};
const PROBE_STATUS = ${js(data.appendix?.byStatus ?? [])};
const BY_COLO = ${js(data.appendix?.byColo ?? [])};

function deltaLabel(n) {
  const value = Number(n) || 0;
  if (value > 0) return \`+\${value}\`;
  return String(value);
}

export default function VisitLog${titleSuffix}Report() {
  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 980 }}>
      <Stack gap={6}>
        <H1>csfields.com visit log — \${PERIOD} report</H1>
        <Text tone="secondary">
          Rolling \${HOURS}h window ending \${RUN_DATE}. Headline is people (200 on / after dropping cloud AS orgs), not 2XX volume.
        </Text>
        <Text size="small" tone="tertiary">
          Source: visit-log D1 · \${String(BOUNDS.earliest ?? "—")} – \${String(BOUNDS.latest ?? "—")}
        </Text>
      </Stack>

      <Stack gap={8}>
        <H2>People this week</H2>
        <Stat value={String(PEOPLE.unique ?? 0)} label="People this week" />
        <Table
          headers={["Metric", "Value"]}
          rows={[
            ["Visits (people rows)", String(PEOPLE.hits ?? 0)],
            ["vs last window", \`\${PEOPLE.prevUnique ?? 0} (\${deltaLabel(PEOPLE.delta)})\`],
            ["Returning", \`\${PEOPLE.returning ?? 0} (\${PEOPLE.returningPct ?? 0}%)\`],
            ["New", String(PEOPLE.newCount ?? 0)],
            ["Repeat 1 / 2–4 / 5+", \`\${REPEATS.one ?? 0} / \${REPEATS.twoToFour ?? 0} / \${REPEATS.fivePlus ?? 0}\`],
            ["Page views", String(EVENTS.view ?? 0)],
            ["LinkedIn", String(EVENTS.linkedin ?? 0)],
            ["mailto", String(EVENTS.mailto ?? 0)],
            ["Bio rolls", String(EVENTS.bio ?? 0)],
            ["Dwell (median ms)", EVENTS.dwellMedianMs == null ? String(EVENTS.dwell ?? 0) : \`\${EVENTS.dwell ?? 0} / \${EVENTS.dwellMedianMs}\`],
          ]}
          columnAlign={["left", "right"]}
        />
        <Table
          headers={["Country", "AS org", "People", "Visits"]}
          rows={BY_COUNTRY_AS.map((r) => [r.country || "(blank)", r.as_org || "(blank)", String(r.unique), String(r.hits)])}
          columnAlign={["left", "left", "right", "right"]}
        />
        <Table
          headers={["Device", "People"]}
          rows={BY_DEVICE.map((r) => [r.family, String(r.n)])}
          columnAlign={["left", "right"]}
        />
        <Table
          headers={["Hour ET", "Visits"]}
          rows={BY_HOUR_ET.map((r) => [\`\${String(r.hour).padStart(2, "0")}:00\`, String(r.n)])}
          columnAlign={["left", "right"]}
        />
        <Table
          headers={["How they arrived", "People"]}
          rows={BY_REFERRER.map((r) => [r.bucket, String(r.n)])}
          columnAlign={["left", "right"]}
        />
        <Callout tone="neutral" title="Noise collapsed">
          {NOISE.redirects ?? 0} www/http redirects · {NOISE.faviconRobots ?? 0} favicon/robots · {NOISE.probes ?? 0} real probes · {NOISE.cloud2xx ?? 0} cloud 2XX dropped.
        </Callout>
        <Text size="small" tone="tertiary">
          2XX footnote: {FOOTNOTE_2XX.requests ?? 0} requests from {FOOTNOTE_2XX.unique_ips ?? 0} IPs.
        </Text>
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Appendix — colo, status, split noise</H2>
        <Table
          headers={["Colo", "2XX requests"]}
          rows={BY_COLO.map((r) => [r.colo, String(r.n)])}
          columnAlign={["left", "right"]}
        />
        <Table
          headers={["Status", "Count"]}
          rows={PROBE_STATUS.map((r) => [String(r.status ?? "null"), String(r.n)])}
          columnAlign={["left", "right"]}
        />
        <Table
          headers={["Redirects", "Status", "Count"]}
          rows={REDIRECTS.map((r) => [r.path, String(r.status ?? ""), String(r.n)])}
          columnAlign={["left", "right", "right"]}
        />
        <Table
          headers={["favicon/robots", "Status", "Count"]}
          rows={FAVICON_ROBOTS.map((r) => [r.path, String(r.status ?? ""), String(r.n)])}
          columnAlign={["left", "right", "right"]}
        />
        <Table
          headers={["Real probes", "Count"]}
          rows={PROBES.map((r) => [r.path, String(r.n)])}
          columnAlign={["left", "right"]}
          striped
        />
      </Stack>

      <Text size="small" tone="tertiary">— Q · csfields.com traffic intelligence</Text>
    </Stack>
  );
}
`;
}

/**
 * @param {{ periodSlug: string, periodLabel: string, runDate: string, hours: number, data: object }} opts
 * @returns {{ path: string, name: string }}
 */
export function writeCanvas(opts) {
  const canvasDir = defaultCanvasDir();
  fs.mkdirSync(canvasDir, { recursive: true });

  const name = `visit-log-${opts.periodSlug}-${opts.runDate}.canvas.tsx`;
  const filePath = path.join(canvasDir, name);
  fs.writeFileSync(filePath, renderCanvasSource(opts), 'utf8');
  return { path: filePath, name };
}
