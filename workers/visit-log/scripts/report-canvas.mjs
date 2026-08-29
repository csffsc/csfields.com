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
    const slug = parts
      .slice(usersIdx)
      .join('-')
      .replace(/\./g, '-');
    const cursorCanvasDir = path.join(home, '.cursor', 'projects', slug, 'canvases');
    if (fs.existsSync(path.dirname(cursorCanvasDir))) {
      return cursorCanvasDir;
    }
  }

  return path.join(REPO_ROOT, 'canvases');
}

/**
 * @param {{ periodSlug: string, periodLabel: string, runDate: string, hours: number, data: object }} opts
 * @returns {string}
 */
export function renderCanvasSource({ periodSlug, periodLabel, runDate, hours, data }) {
  const t = data.totals;
  const total2xx = Number(t?.requests ?? 0);
  const probeN = Number(data.appendix.probeTotals?.n ?? 0);

  return `import {
  Stack, H1, H2, Text, Divider, Stat, Table, Callout,
} from "cursor/canvas";

const PERIOD = ${JSON.stringify(periodLabel)};
const HOURS = ${hours};
const RUN_DATE = ${JSON.stringify(runDate)};
const BOUNDS = ${JSON.stringify(data.bounds ?? {})};
const TOTALS = ${JSON.stringify(t ?? {})};
const BY_COUNTRY = ${JSON.stringify(data.byCountry, null, 2)};
const BY_COLO = ${JSON.stringify(data.byColo, null, 2)};
const BY_PATH = ${JSON.stringify(data.byPath, null, 2)};
const PROBE_TOTAL = ${probeN};
const PROBE_PATHS = ${JSON.stringify(data.appendix.probePaths, null, 2)};
const PROBE_STATUS = ${JSON.stringify(data.appendix.byStatus, null, 2)};

function pct(n, total) {
  if (!total) return "0%";
  return \`\${Math.round((n / total) * 100)}%\`;
}

export default function VisitLog${periodSlug.charAt(0).toUpperCase() + periodSlug.slice(1)}Report() {
  const total2xx = Number(TOTALS.requests ?? 0);
  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 980 }}>
      <Stack gap={6}>
        <H1>csfields.com visit log — \${PERIOD} report</H1>
        <Text tone="secondary">
          Rolling \${HOURS}h window ending \${RUN_DATE}. Part A: 2XX only. Part B: probes and non-2XX appendix.
        </Text>
        <Text size="small" tone="tertiary">
          Source: visit-log D1 · \${String(BOUNDS.earliest ?? "—")} – \${String(BOUNDS.latest ?? "—")}
        </Text>
      </Stack>

      <Stack gap={8}>
        <H2>2XX summary</H2>
        <Stat value={String(total2xx)} label="2XX requests" />
        <Table
          headers={["Country", "Requests", "Share"]}
          rows={BY_COUNTRY.map((r) => [r.country || "(blank)", String(r.n), pct(Number(r.n), total2xx)])}
          columnAlign={["left", "right", "right"]}
        />
        <Table
          headers={["Colo", "Requests", "Share"]}
          rows={BY_COLO.map((r) => [r.colo, String(r.n), pct(Number(r.n), total2xx)])}
          columnAlign={["left", "right", "right"]}
        />
        <Table
          headers={["Path", "Requests"]}
          rows={BY_PATH.map((r) => [r.path, String(r.n)])}
          columnAlign={["left", "right"]}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Appendix — probes and non-2XX</H2>
        <Callout tone="info" title="Separate from 2XX totals">
          {PROBE_TOTAL} rows in this window.
        </Callout>
        <Table
          headers={["Status", "Count"]}
          rows={PROBE_STATUS.map((r) => [String(r.status ?? "null"), String(r.n)])}
          columnAlign={["left", "right"]}
        />
        <Table
          headers={["Path", "Count"]}
          rows={PROBE_PATHS.map((r) => [r.path, String(r.n)])}
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
