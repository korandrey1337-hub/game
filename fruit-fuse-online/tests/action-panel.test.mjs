import test from "node:test";
import assert from "node:assert/strict";
import { createActionRenderer } from "../public/action-panel.js";

function mockPanel() {
  return {
    writes: 0,
    button: null,
    get innerHTML() { return this.serialized; },
    set innerHTML(markup) {
      this.writes += 1;
      this.serialized = markup.replaceAll(" >", ">").replaceAll(" disabled>", ' disabled="">');
      this.button = markup ? { markup } : null;
    }
  };
}

test("state updates preserve a pressed action button despite HTML normalization", () => {
  const panel = mockPanel();
  const render = createActionRenderer(panel);
  const markup = '<button data-action="cue" >Now</button>';
  render(markup);
  const pressedButton = panel.button;
  assert.notEqual(panel.innerHTML, markup);
  for (let tick = 0; tick < 200; tick += 1) render(markup);
  assert.equal(panel.writes, 1);
  assert.equal(panel.button, pressedButton);
});

test("phase and enabled-state changes update actions once and can be cleared", () => {
  const panel = mockPanel();
  const render = createActionRenderer(panel);
  const waiting = '<button data-action="resolve" disabled>Launch</button>';
  const ready = '<button data-action="resolve" >Launch</button>';
  for (const markup of [waiting, ready, waiting, ""]) {
    render(markup);
    render(markup);
  }
  assert.equal(panel.writes, 4);
  assert.equal(panel.button, null);
  render(ready);
  assert.equal(panel.writes, 5);
});
