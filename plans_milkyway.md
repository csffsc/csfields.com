# Plan: Milky Way Galaxy SVG at top of csfields.com

## Context
Add a subtle atmospheric Milky Way band as a decorative SVG element at the top of the page, mirroring the existing treeline SVG at the bottom. Creates a bookend: cosmos above, personal content centered, forest below. The user referenced the panoramic Milky Way photo and wants a subtle SVG interpretation — not a literal image, just the essence.

## Critical File
- `/Users/chris/Code/csfields.com/index.html` — sole file, all CSS inline

## Approach

Insert `.galaxy` as the **first child of `<body>`** (before `<div class="card">`), matching the treeline's sibling position. The SVG is 1200×200 viewBox with `preserveAspectRatio="none"`.

### CSS to add (inside existing `<style>`, alongside `.treeline`):
```css
.galaxy {
  width: 100%;
  display: block;
  flex-shrink: 0;
  opacity: 0;
  animation: arrive 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0s forwards;
}
```
Reuses the existing `arrive` keyframe. Starts 0.2s before the card (no delay vs card's 0.2s delay), so the sky materializes first.

### SVG structure — layer order:
1. **Stars** (~70 `<circle>` elements, r=0.4–2.0, scattered across full area with density toward band center y≈100)
2. **Vertical band shape** — `<rect>` full-size with `mw-band-v` gradient (transparent → amber peak at 50% → transparent)
3. **Horizontal color variation** — `<rect>` full-size with `mw-band-h` gradient (blue-cool at edges → warm center)
4. **Edge fade overlay** — `<rect>` full-size with `mw-fade` gradient (solid `#141210` at top/bottom → transparent inside) — this sits on top to guarantee seamless blending with the page background

### Gradient definitions (`gradientUnits="userSpaceOnUse"`, viewBox coords):

**`mw-fade`** — vertical, blends SVG into background at top/bottom edges:
```
0%   → #141210 opacity 1   (solid at top)
18%  → #141210 opacity 0   (fades to transparent)
82%  → #141210 opacity 0
100% → #141210 opacity 1   (solid at bottom)
```

**`mw-band-v`** — vertical bell-curve for the band cross-section:
```
0%   → #c8a870 opacity 0
30%  → #c8a870 opacity 0
47%  → #c8a870 opacity 0.05
50%  → #d4b090 opacity 0.09   ← peak (y=100)
53%  → #c8a870 opacity 0.05
70%  → #c8a870 opacity 0
100% → #c8a870 opacity 0
```

**`mw-hband`** — horizontal warmth variation:
```
0%   → #6878a8 opacity 0
22%  → #6878a8 opacity 0.03
42%  → #a08060 opacity 0.05
52%  → #e0c090 opacity 0.07   ← warmest (slightly left of center)
67%  → #8090a8 opacity 0.04
88%  → #6878a8 opacity 0.02
100% → #6878a8 opacity 0
```

### Stars — 70 circles:
Distributed across 1200×200, denser near y=80–120. Mix of white `#ffffff`, blue-white `#cce8ff`, warm-white `#fff8e0`:

```
cx=38   cy=22  r=0.8 op=0.35 #ffffff    cx=87   cy=145 r=0.6 op=0.28 #cce8ff
cx=115  cy=58  r=1.1 op=0.55 #ffffff    cx=142  cy=182 r=0.5 op=0.20 #ffffff
cx=178  cy=38  r=0.7 op=0.42 #fff8e0    cx=203  cy=96  r=1.4 op=0.68 #ffffff
cx=231  cy=125 r=0.9 op=0.52 #fff8e0    cx=258  cy=12  r=0.6 op=0.32 #ffffff
cx=276  cy=165 r=0.7 op=0.25 #cce8ff    cx=304  cy=82  r=1.6 op=0.72 #ffffff
cx=329  cy=112 r=1.0 op=0.60 #fff8e0    cx=351  cy=48  r=0.5 op=0.30 #ffffff
cx=368  cy=138 r=1.2 op=0.55 #cce8ff    cx=392  cy=25  r=0.9 op=0.45 #ffffff
cx=418  cy=95  r=1.8 op=0.75 #ffffff    cx=437  cy=158 r=0.6 op=0.22 #ffffff
cx=461  cy=72  r=1.1 op=0.58 #fff8e0    cx=484  cy=118 r=2.0 op=0.80 #ffffff
cx=502  cy=185 r=0.5 op=0.18 #cce8ff    cx=521  cy=44  r=0.7 op=0.38 #ffffff
cx=543  cy=105 r=1.5 op=0.70 #fff8e0    cx=567  cy=130 r=1.0 op=0.62 #ffffff
cx=589  cy=18  r=0.8 op=0.40 #ffffff    cx=608  cy=88  r=1.7 op=0.78 #fff8e0
cx=632  cy=152 r=0.6 op=0.24 #ffffff    cx=651  cy=65  r=1.2 op=0.56 #cce8ff
cx=672  cy=110 r=1.9 op=0.82 #ffffff    cx=695  cy=34  r=0.7 op=0.36 #ffffff
cx=714  cy=138 r=1.0 op=0.58 #fff8e0    cx=738  cy=78  r=0.5 op=0.28 #ffffff
cx=762  cy=92  r=1.6 op=0.74 #ffffff    cx=783  cy=168 r=0.7 op=0.22 #cce8ff
cx=801  cy=52  r=1.0 op=0.50 #ffffff    cx=822  cy=122 r=1.3 op=0.65 #ffffff
cx=843  cy=8   r=0.6 op=0.32 #fff8e0    cx=865  cy=108 r=1.8 op=0.76 #ffffff
cx=882  cy=175 r=0.5 op=0.19 #ffffff    cx=901  cy=62  r=0.9 op=0.46 #cce8ff
cx=924  cy=135 r=1.4 op=0.68 #ffffff    cx=948  cy=28  r=0.7 op=0.38 #ffffff
cx=967  cy=98  r=1.1 op=0.55 #fff8e0    cx=989  cy=148 r=0.8 op=0.35 #ffffff
cx=1012 cy=42  r=1.5 op=0.70 #ffffff    cx=1035 cy=115 r=0.6 op=0.30 #cce8ff
cx=1054 cy=80  r=1.0 op=0.52 #ffffff    cx=1078 cy=160 r=0.7 op=0.24 #fff8e0
cx=1095 cy=55  r=1.2 op=0.58 #ffffff    cx=1118 cy=102 r=1.7 op=0.72 #ffffff
cx=1143 cy=188 r=0.5 op=0.17 #ffffff    cx=1162 cy=70  r=0.9 op=0.44 #cce8ff
cx=72   cy=108 r=0.6 op=0.30 #ffffff    cx=156  cy=118 r=1.3 op=0.62 #fff8e0
cx=245  cy=88  r=0.9 op=0.48 #ffffff    cx=315  cy=142 r=0.5 op=0.22 #ffffff
cx=445  cy=82  r=1.1 op=0.54 #cce8ff    cx=512  cy=155 r=0.7 op=0.32 #ffffff
cx=575  cy=72  r=1.4 op=0.66 #fff8e0    cx=645  cy=95  r=0.8 op=0.42 #ffffff
cx=720  cy=118 r=1.6 op=0.74 #ffffff    cx=795  cy=85  r=0.7 op=0.38 #cce8ff
cx=855  cy=130 r=1.0 op=0.55 #ffffff    cx=935  cy=72  r=1.2 op=0.60 #fff8e0
cx=1005 cy=125 r=0.8 op=0.40 #ffffff    cx=1070 cy=90  r=1.5 op=0.68 #ffffff
cx=1130 cy=140 r=0.6 op=0.28 #cce8ff    cx=190  cy=145 r=0.9 op=0.42 #ffffff
cx=420  cy=150 r=0.7 op=0.30 #ffffff    cx=690  cy=155 r=1.1 op=0.50 #fff8e0
cx=960  cy=160 r=0.6 op=0.26 #ffffff    cx=1180 cy=32  r=1.0 op=0.48 #ffffff
```

### Insertion point in index.html:
```html
<body>
  <svg class="galaxy" ...>  ← INSERT HERE (line 107, before <div class="card">)
  <div class="card">
```

## Verification
After implementing:
1. Open `index.html` in a browser (or use `python3 -m http.server` in the project dir)
2. Check: galaxy SVG visible at top with faint star field and milky way glow
3. Check: smooth edge fade at top and bottom of galaxy SVG (no hard edges)
4. Check: card text fades in after galaxy appears
5. Check: treeline still visible at bottom
6. Resize to mobile width — galaxy should compress gracefully with `preserveAspectRatio="none"`
7. Adjust `stop-opacity` values up if the band is too faint, down if too prominent