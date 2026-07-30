import {
  Stack,
  Row,
  Grid,
  H1,
  H2,
  H3,
  Text,
  Code,
  Callout,
  Divider,
  useHostTheme,
} from "cursor/canvas";

const STARS: Array<[number, number, number]> = [
  [18, 12, 1.1], [45, 40, 0.8], [70, 18, 1.4], [95, 50, 0.7], [120, 30, 1.8],
  [140, 34, 1.2], [160, 28, 2.0], [178, 36, 1.3], [196, 30, 1.7], [212, 26, 1.1],
  [228, 34, 1.9], [245, 30, 1.4], [262, 36, 1.0], [280, 28, 1.6], [300, 44, 0.8],
  [318, 20, 1.2], [340, 52, 0.7], [360, 14, 1.3], [382, 38, 0.9], [30, 52, 0.7],
  [105, 8, 0.9], [150, 12, 0.7], [250, 10, 0.8], [290, 56, 0.6], [370, 58, 0.7],
];

const TREES: Array<[number, number]> = [
  [4, 46], [26, 58], [48, 42], [70, 54], [92, 62], [114, 48], [136, 58],
  [158, 40], [180, 56], [202, 46], [224, 60], [246, 50], [268, 62], [290, 44],
  [312, 56], [334, 48], [356, 58], [378, 42],
];

function Arrow({ color }: { color: string }) {
  return (
    <svg
      width="52"
      height="20"
      viewBox="0 0 52 20"
      style={{ display: "block", flexShrink: 0 }}
    >
      <line x1="2" y1="10" x2="40" y2="10" stroke={color} strokeWidth="1.5" />
      <polygon points="40,4 52,10 40,16" fill={color} />
    </svg>
  );
}

function Tag({ kind }: { kind: "snap" | "fade" | "mixed" }) {
  const t = useHostTheme();
  const label = kind === "snap" ? "SNAP" : kind === "fade" ? "FADE" : "SNAP + REPLAY";
  return (
    <span
      style={{
        color: kind === "snap" ? t.text.tertiary : t.accent.primary,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function MockLabel({
  title,
  load,
  slot,
  tag,
}: {
  title: string;
  load: string;
  slot: string;
  tag: "snap" | "fade" | "mixed";
}) {
  return (
    <Stack gap={3} style={{ textAlign: "right" }}>
      <Row gap={6} justify="end" align="center">
        <Tag kind={tag} />
        <Text weight="semibold" size="small">
          {title}
        </Text>
      </Row>
      <Text size="small" tone="secondary">
        {load}
      </Text>
      <Text size="small" tone="tertiary">
        {slot}
      </Text>
    </Stack>
  );
}

function PageMock() {
  const t = useHostTheme();
  const frame = {
    border: `1px solid ${t.stroke.secondary}`,
    background: t.bg.chrome,
    width: "100%",
  };
  return (
    <Grid columns="minmax(0, 250px) 52px minmax(0, 1fr)" gap={10} align="center">
      <MockLabel
        title="Body background"
        load="Paints immediately with the first palette"
        slot="2s ease crossfade — the only transitioned property"
        tag="fade"
      />
      <Arrow color={t.accent.primary} />
      <div style={{ ...frame, height: 12 }} />

      <MockLabel
        title="Galaxy SVG"
        load="Load: fade-in 1.4s, no delay — appears before the card"
        slot="Hidden 07–17h · 45% at dusk · replays 1.4s fade at 21h (dusk→night)"
        tag="mixed"
      />
      <Arrow color={t.stroke.secondary} />
      <div style={frame}>
        <svg
          viewBox="0 0 400 64"
          preserveAspectRatio="none"
          style={{ width: "100%", height: 64, display: "block" }}
        >
          {STARS.map((s, i) => (
            <circle key={i} cx={s[0]} cy={s[1]} r={s[2]} fill={t.text.quaternary} />
          ))}
        </svg>
      </div>

      <MockLabel
        title="Name"
        load="Load: with card — 1s fade + 12px rise, after 0.2s delay"
        slot="--ink snaps to the new palette instantly"
        tag="snap"
      />
      <Arrow color={t.stroke.secondary} />
      <div style={{ ...frame, padding: "14px 0", textAlign: "center" }}>
        <span
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 26,
            color: t.text.primary,
            letterSpacing: "-0.02em",
          }}
        >
          Chris <em style={{ color: t.accent.primary }}>Fields</em>
        </span>
      </div>

      <MockLabel
        title="Rule + bio"
        load="Load: part of the same card fade"
        slot="--ink-faint / --ink-muted snap instantly"
        tag="snap"
      />
      <Arrow color={t.stroke.secondary} />
      <div style={{ ...frame, padding: "12px 0", textAlign: "center" }}>
        <div
          style={{
            width: 28,
            height: 1,
            background: t.stroke.primary,
            margin: "0 auto 10px",
          }}
        />
        <span
          style={{
            color: t.text.tertiary,
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Engineer by trade · Curious by nature
        </span>
      </div>

      <MockLabel
        title="Contact links"
        load="Load: part of the same card fade"
        slot="Color fades over 0.2s — the hover transition leaks into slot flips"
        tag="fade"
      />
      <Arrow color={t.stroke.secondary} />
      <div style={{ ...frame, padding: "10px 0", textAlign: "center" }}>
        <span style={{ color: t.text.link, fontSize: 11 }}>
          chris@csfields.com&nbsp;&nbsp;&nbsp;LinkedIn
        </span>
      </div>

      <MockLabel
        title="Treeline SVG"
        load="Load: no animation — visible from the first frame"
        slot="Edge fade snaps to new --paper; tree greens are hardcoded and never change"
        tag="snap"
      />
      <Arrow color={t.stroke.secondary} />
      <div style={frame}>
        <svg
          viewBox="0 0 400 64"
          preserveAspectRatio="none"
          style={{ width: "100%", height: 64, display: "block" }}
        >
          {TREES.map((tr, i) => (
            <polygon
              key={i}
              points={`${tr[0]},62 ${tr[0] + 10},${64 - tr[1]} ${tr[0] + 20},62`}
              fill={i % 3 === 0 ? t.fill.quaternary : i % 3 === 1 ? t.stroke.secondary : t.fill.tertiary}
            />
          ))}
        </svg>
      </div>
    </Grid>
  );
}

const TRACKS: Array<{
  label: string;
  start: number;
  end: number;
  kind: "fade" | "snap" | "window";
  note: string;
}> = [
  { label: "Body background (--paper)", start: 0, end: 2, kind: "fade", note: "2s ease crossfade" },
  { label: "Name / bio / rule colors", start: 0, end: 0, kind: "snap", note: "instant at t=0" },
  { label: "SVG edge-fade stops", start: 0, end: 0, kind: "snap", note: "instant — now ahead of the background" },
  { label: "Contact link color", start: 0, end: 0.2, kind: "fade", note: "0.2s (hover transition)" },
  { label: "Galaxy at dusk→night only", start: 0, end: 1.4, kind: "fade", note: "arrive animation restarts, 1.4s" },
  { label: "Mismatch window", start: 0, end: 2, kind: "window", note: "fades & text at new values, background still fading" },
];

function SlotTimeline() {
  const t = useHostTheme();
  const ticks = [0, 0.5, 1, 1.5, 2];
  return (
    <Stack gap={8}>
      <Stack gap={6}>
        {TRACKS.map((trk) => (
          <div key={trk.label}>
          <Row gap={10} align="center">
            <div style={{ width: 220, textAlign: "right", flexShrink: 0 }}>
              <Text size="small" tone="secondary">
                {trk.label}
              </Text>
            </div>
            <div style={{ position: "relative", flex: 1, height: 18 }}>
              {trk.kind === "snap" ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 2,
                    width: 3,
                    height: 14,
                    background: t.text.tertiary,
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    left: `${(trk.start / 2) * 100}%`,
                    top: 4,
                    width: `${Math.max(((trk.end - trk.start) / 2) * 100, 0.8)}%`,
                    height: 10,
                    background: trk.kind === "fade" ? t.accent.primary : "transparent",
                    border: trk.kind === "window" ? `1px dashed ${t.stroke.primary}` : "none",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: `calc(${(trk.end / 2) * 100}% + 8px)`,
                  top: 3,
                  color: t.text.tertiary,
                  fontSize: 10,
                  whiteSpace: "nowrap",
                }}
              >
                {trk.note}
              </div>
            </div>
          </Row>
          </div>
        ))}
      </Stack>
      <Row gap={10} align="center">
        <div style={{ width: 220, flexShrink: 0 }} />
        <div style={{ position: "relative", flex: 1, height: 16 }}>
          {ticks.map((v) => (
            <div
              key={v}
              style={{
                position: "absolute",
                left: `${(v / 2) * 100}%`,
                transform: v === 0 ? "none" : "translateX(-50%)",
                color: t.text.tertiary,
                fontSize: 10,
              }}
            >
              {v}s
            </div>
          ))}
        </div>
      </Row>
      <Text size="small" tone="tertiary">
        Time (seconds) since apply() flips the palette. Solid accent = smooth transition · gray tick = instant snap · dashed outline = mismatch window.
        Source: index.html @ 52d92c3 — arrive keyframes, body transition, data-time rules.
      </Text>
    </Stack>
  );
}

export default function PageTimingMap() {
  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 980 }}>
      <Stack gap={6}>
        <H1>csfields.com — element timing map</H1>
        <Text tone="secondary">
          Arrows point from each element to how it moves, on initial page load and on a
          time-slot palette flip (checked every 60s by the inline script). Mock is
          schematic; colors are illustrative.
        </Text>
      </Stack>

      <PageMock />

      <Divider />

      <Stack gap={10}>
        <H2>What happens in the 2 seconds after a slot flips</H2>
        <SlotTimeline />
      </Stack>

      <Callout tone="warning" title="The observation">
        The 2s crossfade only covers the body background. Text, the rule, and both SVG
        edge-fade overlays snap to the new palette instantly — so for up to ~2 seconds
        after a flip, the galaxy and treeline edges are already the new paper color while
        the background behind them is still mid-fade: a visible halo seam at the top and
        bottom of the page. Ink colors also snap against a half-faded background. One
        accidental grace: at dusk→night (21h) the galaxy replays its 1.4s arrive fade,
        because removing the data-time override restarts its CSS animation.
      </Callout>

      <Stack gap={8}>
        <H3>Making it consistent</H3>
        <Text size="small" tone="secondary">
          1. Register the palette vars with <Code>@property</Code> (syntax:{" "}
          <Code>&lt;color&gt;</Code>) and put <Code>transition: --paper 2s ease</Code> on{" "}
          <Code>:root</Code> — the variable itself then animates, so the body background
          and every SVG stop fade together in one declaration.
        </Text>
        <Text size="small" tone="secondary">
          2. Or target the stragglers directly: <Code>stop {"{"} transition: stop-color 2s ease {"}"}</Code>{" "}
          plus <Code>color 2s ease</Code> / <Code>background-color 2s ease</Code> on the
          text elements and rule.
        </Text>
        <Text size="small" tone="secondary">
          3. Optional: the treeline's polygon greens are hardcoded — give each time slot
          its own tree palette if the forest should also pass through golden hour.
        </Text>
      </Stack>
    </Stack>
  );
}
