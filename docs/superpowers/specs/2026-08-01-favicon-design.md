# Favicon design — csfields.com

## Goal

Add a favicon that matches the personal site’s typography and palette: a dual-tone **CF** mark that reads clearly in light and dark browser chrome.

## Mark

- Side-by-side letters **C** and **F**
- Serif face approximating Cormorant Garamond (system serif fallback is fine in SVG)
- **C**: roman (upright), weight light (~300)
- **F**: italic, sage accent `#5c7a4a`
- **Spacing**: balanced (as approved in brainstorm refinements)
- No tree, star, or other page motifs in the icon

## Color behavior

Single SVG using `prefers-color-scheme`:

| Scheme | Background | C | F |
|--------|------------|---|---|
| Dark (default) | `#141210` (site night paper) | `#e8e4dc` | `#5c7a4a` |
| Light | `#e8e4dc` (brand cream) | `#141210` | `#5c7a4a` |

Filled square (not transparent letters alone) so the mark stays legible in the tab.

## Delivery

- **Approach A**: one dual-tone SVG only
- File: `/favicon.svg` at site root
- Wire in `index.html`:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
```

## Out of scope

- `favicon.ico` / PNG sizes
- Apple touch icon
- Favicon that shifts with the page’s time-of-day palettes

## Acceptance

- Tab shows CF with italic sage F
- Dark OS/browser chrome uses cream C on night ground
- Light OS/browser chrome uses dark C on light ground
- No other new assets required
