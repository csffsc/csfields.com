import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('uses one decorative sky detail SVG container', () => {
  assert.match(html, /<svg class="sky-detail"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /<svg class="galaxy"/);
  assert.match(html, /\.sky-detail\s*\{[^}]*pointer-events:\s*none/s);
});

test('maps one approved narrative scene to every time state', () => {
  const states = ['predawn', 'morning', 'afternoon', 'dusk', 'night'];

  for (const state of states) {
    assert.match(html, new RegExp(`class="sky-scene scene-${state}"`));
    assert.match(
      html,
      new RegExp(`\\[data-time="${state}"\\] \\.scene-${state}\\s*\\{[^}]*opacity:\\s*1`, 's'),
    );
  }

  assert.match(html, /class="predawn-crescent"/);
  assert.match(html, /class="weather-balloon"/);
  assert.match(html, /class="morning-sun"/);
  assert.equal(html.match(/class="morning-bird"/g)?.length, 3);
  assert.match(html, /class="afternoon-cloud"/);
  assert.match(html, /class="afternoon-drone"/);
  assert.match(html, /class="dusk-contrail"/);
  assert.match(html, /class="dusk-plane"/);
  assert.match(html, /class="satellite-track"/);
});

test('shows faint stars before night without exposing the Milky Way', () => {
  assert.match(html, /class="sky-atmosphere scene-stars"/);
  assert.match(html, /class="sky-atmosphere scene-milky-way"/);
  assert.doesNotMatch(html, /class="scene-night-base"/);

  assert.match(
    html,
    /\[data-time="predawn"\] \.scene-stars\s*\{[^}]*opacity:\s*0\.28/s,
  );
  assert.match(
    html,
    /\[data-time="dusk"\] \.scene-stars\s*\{[^}]*opacity:\s*0\.45/s,
  );
  assert.match(
    html,
    /\[data-time="night"\] \.scene-milky-way\s*\{[^}]*opacity:\s*1/s,
  );
});

test('keeps scene transitions accessible and responsive', () => {
  assert.match(html, /\.sky-scene\s*\{[^}]*transition:\s*opacity 2s ease/s);
  assert.match(
    html,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.sky-scene\s*\{[^}]*transition:\s*none/,
  );
  assert.match(
    html,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.sky-atmosphere\s*\{[^}]*transition:\s*none/,
  );
  assert.match(html, /vector-effect="non-scaling-stroke"/);
});
