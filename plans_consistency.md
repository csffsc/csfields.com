# Plan: Consistent palette transitions on time-slot flips

## Context
When `apply()` flips a time slot it changes five CSS vars plus `data-time` in one frame, but only `body { transition: background-color 2s ease }` animates. Text colors, the rule, and both SVG edge-fade gradients (`stop-color: var(--paper)`) snap instantly — producing a ~2s halo seam where the galaxy/treeline edges are already the new `--paper` while the background is still mid-crossfade. Side quirks: contact links fade in 0.2s (their hover transition leaks in), and at dusk→night the galaxy replays its 1.4s `arrive` animation because the override removal restarts it.

## Critical File
- `/Users/chris/Code/csfields.com/index.html` — sole file, all CSS and JS inline

## Item 1 — Transition the variables themselves via `@property` (recommended)

Insert after the `:root` block (after line 19):

```css
@property --paper     { syntax: '<color>'; inherits: true; initial-value: #141210; }
@property --ink       { syntax: '<color>'; inherits: true; initial-value: #e8e4dc; }
@property --ink-muted { syntax: '<color>'; inherits: true; initial-value: #6b6760; }
@property --ink-faint { syntax: '<color>'; inherits: true; initial-value: #7a7670; }
@property --accent    { syntax: '<color>'; inherits: true; initial-value: #5c7a4a; }

html {
  transition: --paper 2s ease, --ink 2s ease, --ink-muted 2s ease,
              --ink-faint 2s ease, --accent 2s ease;
}
```

- Registered `<color>` custom properties interpolate, so **every consumer** — body background, name/bio text, rule, and both SVG fade gradients — animates in lockstep from one declaration. Seam eliminated.
- JS untouched: `apply()` keeps calling `style.setProperty` on `documentElement`; inline changes to registered vars still trigger the transition.
- `body { transition: background-color 2s ease }` (lines 118–120) becomes redundant — harmless to keep, fine to remove.
- Graceful degradation: browsers without `@property` (pre-Safari 16.4 / pre-Firefox 128) keep today's snap behavior.

## Item 2 — Targeted transitions (alternative / fallback)

Only if avoiding `@property`:

```css
stop { transition: stop-color 2s ease; }        /* covers mw-fade + sidefade */
.name, .bio { transition: color 2s ease; }
.rule { transition: background-color 2s ease; }
.contact a:hover { transition-duration: 0.2s; }  /* preserves snappy hover */
```

The contact link note: its base `transition: color 0.2s` currently doubles as a fast slot-flip fade; unify to 2s on the base rule and override duration on `:hover` so hover feedback stays quick.

## Item 3 — Per-slot treeline palette (optional)

Trees are hardcoded greens (`#2d3e28` / `#3d5c3a` / `#4a6639` / `#5c7a4a`, lines 304–340) — only their side fade tracks the palette.

1. Replace the four `fill` values with classes `t1`–`t4` mapped to `var(--tree-1)` … `var(--tree-4)`.
2. Add `--tree-1..4` to `:root` (current greens) and to each entry of the script's `palettes` object (lines 135–141); set them in `apply()` alongside the existing five vars.
3. Suggested moods: predawn = deep blue-green, morning = warm sunlit green, afternoon = brighter saturated green, dusk = muted purple-brown silhouette, night = current greens.
4. Register `--tree-1..4` with `@property` per Item 1 so the forest crossfades too.

## Sequence
1. Item 1 — small diff, eliminates the seam.
2. Item 3 — forest palettes.
3. Item 2 — only as a fallback for older browsers.

## Verification
1. `python3 -m http.server`, then in DevTools console force a flip: `document.documentElement.style.setProperty('--paper', '#1e4870')` — background and SVG edges should move together every frame, no seam.
2. Temporarily edit `slot()` to return a different slot, reload, and watch the full 2s: text, rule, fades, and background stay matched throughout.
3. Mid-fade contrast check on the predawn→morning boundary (dark blue → amber).
4. If Item 2 applied: link hover still feels 0.2s-snappy.
5. Item 3: trees visibly recolor per slot and crossfade with everything else.
6. Simulate no `@property` support (older browser): elements snap as they do today — acceptable degradation.
