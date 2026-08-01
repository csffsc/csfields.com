# Plan: Forest mouseover — Iteration C (Scroll + pointer breeze)

## Context
Implement Iteration C from the forest mouseover comparison. Trees in the bottom treeline SVG "stand taller" in a smooth crest around an active center — following the pointer on desktop, or the viewport center as you scroll on mobile. Subtle, GPU-friendly, and fully compatible with the existing 2s palette crossfades and reduced-motion settings.

## Critical File
- `/Users/chris/Code/csfields.com/index.html` — sole file, all CSS/JS inline

## What the user sees
- **Desktop:** As the cursor moves along the bottom, trees within ~150px rise slightly (a few pixels at most) like a soft wind crest. Moving the cursor away settles them.
- **Mobile:** As the page scrolls (or on load), the tree nearest the horizontal center of the viewport stands a touch taller. No pointer needed.
- The effect is additive: trees never dip below their original height, only rise up to ~8% with a smooth falloff.

## Approach

### 1. CSS
Add inside the existing `<style>`:

```css
.treeline polygon {
  transform-box: fill-box;
  transform-origin: center bottom;
}
```

This makes per-polygon `scaleY()` grow upward from the base instead of the SVG canvas origin.

### 2. JS
Extend the existing inline `<script>` (or add a second small IIFE after it). Do **not** remove the time-of-day palette logic.

Behavior:
- Query all `.treeline polygon` nodes once.
- Determine focus `x` in SVG coordinates (0–680):
  - Desktop: `pointermove` on the treeline SVG (covers mouse and touch drag)
  - Mobile/scroll fallback: viewport center `innerWidth / 2` mapped through the SVG's bounding box
- On each `requestAnimationFrame`, ease the current focus toward the target focus (lerp factor ~0.08) for buttery motion.
- For each polygon, compute `distance = |focusX - polygonCenterX|`, then `bump = max(0, 1 - distance / radius)` where `radius ≈ 120` (SVG units).
- Apply `transform: scaleY(1 + bump * 0.08)` — max ~8% rise at the crest, tapering to 0.

Passive listeners only (`pointermove`, `scroll`, `resize`). No layout reads in the hot path; cache `getBoundingClientRect()` on `resize`/`scroll` and reuse.

### 3. Accessibility & motion safety

```js
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

If `reduced` is true, skip attaching listeners entirely (forest stays static).

### 4. Mobile specifics
- Use `pointermove` on the SVG, not `mousemove`, so touch-drag works.
- `scroll` listener keeps the crest centered on the viewport when there's no pointer (e.g. flick scrolling).
- Because the site is a single viewport-height flex column, scrolling mostly occurs on short/mobile screens — exactly where the fallback matters.

### 5. Performance notes
- Transforms are GPU-composited; no `height`/`width` attribute changes, so no layout thrash.
- 37 polygons × cheap math per frame is trivial.
- Stop the rAF loop when the page is hidden (`visibilitychange`) or when nothing has moved for a few frames.

## Interaction with existing features
- Palette transitions (Items 1–3) animate `fill` via `--tree-*` — independent of transforms.
- `data-time` galaxy visibility unaffected.
- The treeline side-fade (`sidefade`) is applied by a full-size `<rect>` overlay, so scaling polygons never breaks the edge fade.

## Verification
1. `python3 -m http.server` and open on desktop:
   - Move the cursor across the treeline — crest follows smoothly, trees never invert.
   - DevTools reduced-motion emulation: effect disabled.
2. Resize to mobile width (or use device emulation):
   - Scroll the page — center trees rise slightly; no horizontal overflow.
   - Drag a finger across the treeline — crest tracks touch.
3. Check palette flip (force a slot change) — tree colors still crossfade; sway continues.
4. `document.querySelectorAll('.treeline polygon').length` — confirm 37 transforms applied without console errors.

## Size budget
~15 lines of CSS + ~45 lines of vanilla JS (~0.5 KB minified).