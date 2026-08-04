const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const button = require('../src/button.js');
const { FakeDocument } = require('./fake-dom.js');

const newDoc = () => new FakeDocument(button.REPOSITORY_MARKER_SELECTORS);

test('the action is a native link, labelled and accessible', () => {
  const doc = newDoc();
  const parts = button.createButton(doc, () => {});

  assert.strictEqual(parts.button.tagName, 'A');
  assert.strictEqual(parts.button.href, '#');
  assert.strictEqual(parts.button.textContent, '', 'the compact control has no visible text');
  assert.ok(parts.button.getAttribute('aria-label').includes(button.LABELS.en[button.STATE.IDLE]));
  assert.strictEqual(parts.button.getAttribute('title'), parts.button.getAttribute('aria-label'));
  assert.strictEqual(parts.status.getAttribute('role'), 'status');
  assert.strictEqual(parts.status.getAttribute('aria-live'), 'polite');
  assert.strictEqual(parts.panel.getAttribute('aria-label'), 'RiceHub');
  assert.strictEqual(parts.status.className, 'ricehub-visually-hidden');
  assert.strictEqual(parts.button.getAttribute('aria-describedby'), button.STATUS_ID);
});

test('clicking calls the handler exactly once and suppresses the default action', () => {
  const doc = newDoc();
  let calls = 0;
  let prevented = false;
  const parts = button.createButton(doc, () => { calls += 1; });

  parts.button.dispatch('click', { isTrusted: true, preventDefault: () => { prevented = true; } });
  assert.strictEqual(calls, 1);
  assert.strictEqual(prevented, true);
});

test('rapid trusted clicks are throttled but a later retry is allowed', () => {
  const doc = newDoc();
  let calls = 0;
  const parts = button.createButton(doc, () => { calls += 1; });
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;

  try {
    parts.button.dispatch('click', { isTrusted: true });
    parts.button.dispatch('click', { isTrusted: true });
    assert.strictEqual(calls, 1, 'a double click must open only once');
    now += 1000;
    parts.button.dispatch('click', { isTrusted: true });
    assert.strictEqual(calls, 2, 'the user must be able to retry later');
  } finally {
    Date.now = originalNow;
  }
});

test('each state has a label, and the status text follows it', () => {
  const doc = newDoc();
  const parts = button.createButton(doc, () => {});

  for (const state of Object.values(button.STATE)) {
    button.setState(parts, state);
    assert.strictEqual(parts.button.getAttribute('data-ricehub-state'), state);
    assert.strictEqual(parts.status.textContent, button.LABELS.en[state]);
  }
});

test('a failure reason is shown alongside the label', () => {
  const doc = newDoc();
  const parts = button.createButton(doc, () => {});
  button.setState(parts, button.STATE.FAILED, 'rate-limited');
  assert.ok(parts.status.textContent.includes('rate-limited'));
  assert.ok(parts.button.getAttribute('title').includes('rate-limited'));
});

test('the requested state claims only that an open request was sent', () => {
  const label = button.LABELS.en[button.STATE.REQUESTED].toLowerCase();
  assert.strictEqual(label, 'open request sent');
  assert.ok(!/opened|analys|complete|done|finish|ready/.test(label), `misleading label: ${label}`);
});

test('the compact control supports Chinese action and drag instructions', () => {
  const doc = newDoc();
  const parts = button.createButton(doc, () => {}, 'zh-TW');

  assert.ok(parts.button.getAttribute('aria-label').includes(button.LABELS['zh-TW'][button.STATE.IDLE]));
  assert.ok(parts.button.getAttribute('title').includes('拖曳以移動'));
  button.setState(parts, button.STATE.REQUESTED);
  assert.strictEqual(parts.status.textContent, button.LABELS['zh-TW'][button.STATE.REQUESTED]);

  button.setLanguage(parts, 'en');
  assert.strictEqual(parts.status.textContent, button.LABELS.en[button.STATE.REQUESTED]);
  assert.ok(parts.button.getAttribute('title').includes('Drag to move'));
});

test('the stylesheet places the enlarged icon-only control on the left', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'content.css'), 'utf8');
  const icon = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'icons', 'fab', 'ricehub-fab-256.png'),
  );
  assert.match(css, /\.ricehub-panel\s*\{[^}]*bottom:\s*24px;[^}]*width:\s*var\(--ricehub-button-size,\s*88px\);[^}]*height:\s*var\(--ricehub-button-size,\s*88px\);/s);
  assert.match(css, /\.ricehub-analyze-button\s*\{[^}]*width:\s*var\(--ricehub-button-size,\s*88px\);[^}]*height:\s*var\(--ricehub-button-size,\s*88px\);/s);
  // No border at all: the artwork supplies its own ring, so a drawn one doubles it.
  assert.match(css, /\.ricehub-analyze-button\s*\{[^}]*border:\s*0;/s);
  // The fill is the destination colour; failure is the only state drawn on top of it.
  assert.match(css, /\.ricehub-analyze-button\s*\{[^}]*background:\s*var\(--ricehub-button-background,/s);
  assert.match(css, /\[data-ricehub-state="failed"\]\s*\{[^}]*box-shadow:\s*0 0 0 3px #cf222e;/s);
  assert.match(css, /\.ricehub-analyze-button::before\s*\{/);
  // The image fills the control. An inset leaves a gap that the button's own background
  // shows through, and that gap reads as a second border beside the configurable one.
  // Inset so the destination colour reads as a ring rather than being hidden by the art.
  assert.match(css, /\.ricehub-analyze-button::before\s*\{[^}]*width:\s*calc\(100% - 10px\);/s);
  assert.match(css, /url\("icons\/fab\/ricehub-fab-256\.png"\)/);
  assert.match(css, /background-size:\s*contain;/);
  assert.match(css, /background-position:\s*center;/);
  assert.strictEqual(icon.readUInt32BE(16), 256, 'floating icon width');
  assert.strictEqual(icon.readUInt32BE(20), 256, 'floating icon height');
  assert.ok(!css.includes('min-width: 190px'));
});

test('mounting twice yields one button', () => {
  const doc = newDoc();
  const first = button.mount(doc, button.createButton(doc, () => {}));
  const second = button.mount(doc, button.createButton(doc, () => {}));

  assert.ok(first);
  assert.strictEqual(second, first, 'the existing button must be reused, not duplicated');

  const buttons = doc.body.children.filter((child) => child.id === button.PANEL_ID);
  assert.strictEqual(buttons.length, 1);
});

test('mounting fails quietly when the page offers nowhere to sit', () => {
  const doc = new FakeDocument([]); // no selector matches
  assert.strictEqual(button.mount(doc, button.createButton(doc, () => {})), null);
});

test('the repository header validates the page but the panel floats from body', () => {
  const doc = newDoc();
  button.mount(doc, button.createButton(doc, () => {}));
  assert.strictEqual(doc.body.children.some((child) => child.id === button.PANEL_ID), true);
  const preferred = doc.querySelector(button.REPOSITORY_MARKER_SELECTORS[0]);
  assert.strictEqual(preferred.children.some((child) => child.id === button.PANEL_ID), false);
});

test('a matching visible repository breadcrumb wins over legacy containers', () => {
  const repo = { owner: 'mdn', repo: 'webextensions-examples' };
  const selector = '[data-component="Breadcrumbs.Item"][href="/mdn/webextensions-examples"]';
  const doc = newDoc();
  const crumb = doc.createElement('a');
  const breadcrumbs = doc.createElement('nav');
  breadcrumbs.setAttribute('data-component', 'Breadcrumbs');
  crumb.closest = (requested) => (
    requested === '[data-component="Breadcrumbs"]' ? breadcrumbs : null
  );
  breadcrumbs.closest = () => null;
  doc.selectorTargets.set(selector, crumb);
  doc.body.append(breadcrumbs);

  button.mount(doc, button.createButton(doc, () => {}), repo);
  assert.strictEqual(doc.body.children.some((child) => child.id === button.PANEL_ID), true);
});

test('hidden legacy containers are skipped', () => {
  const doc = newDoc();
  const hidden = doc.querySelector(button.REPOSITORY_MARKER_SELECTORS[0]);
  hidden.closest = (selector) => (selector === '[hidden]' ? hidden : null);

  button.mount(doc, button.createButton(doc, () => {}));
  assert.strictEqual(doc.body.children.some((child) => child.id === button.PANEL_ID), true);
});

test('a click the page dispatched is ignored', () => {
  const doc = newDoc();
  let calls = 0;
  const parts = button.createButton(doc, () => { calls += 1; });

  parts.button.dispatch('click', { isTrusted: false });
  parts.button.dispatch('click', {}); // no isTrusted at all
  parts.button.dispatch('click', { isTrusted: 'true' }); // a string is not the boolean
  assert.strictEqual(calls, 0, 'only a browser-generated gesture may activate the button');

  parts.button.dispatch('click', { isTrusted: true });
  assert.strictEqual(calls, 1);
});

test('there is no generic mount point, so non-repository pages get nothing', () => {
  // Measured against live GitHub: repository pages carry these three containers and
  // /orgs/… and /<user> carry none of them, while `main` appears on ordinary pages too.
  assert.ok(!button.REPOSITORY_MARKER_SELECTORS.includes('main'));
  assert.ok(button.REPOSITORY_MARKER_SELECTORS.every((selector) => /repository|pagehead/.test(selector)));

  const ordinaryPage = new FakeDocument(['main', 'body']);
  assert.strictEqual(button.mount(ordinaryPage, button.createButton(ordinaryPage, () => {})), null);
});

test('a look-alike planted by the page is not mistaken for ours', () => {
  const doc = newDoc();
  const decoy = doc.createElement('div');
  decoy.id = button.BUTTON_ID;
  decoy.setAttribute('data-ricehub-repo', 'https://github.com/mdn/webextensions-examples');
  doc.querySelector(button.REPOSITORY_MARKER_SELECTORS[0]).append(decoy);

  assert.strictEqual(button.isOurs(decoy), false);
  assert.strictEqual(button.findExisting(doc), null, 'a decoy must not count as present');

  const mounted = button.mount(doc, button.createButton(doc, () => {}));
  assert.ok(mounted, 'the real button must still mount');
  assert.strictEqual(button.isOurs(mounted), true);

  let occupants = 0;
  for (const node of doc.body.walk()) if (node.id === button.BUTTON_ID) occupants += 1;
  assert.strictEqual(occupants, 1, 'the decoy must be cleared, not left alongside');
});

test('a decoy planted after ours is still noticed', () => {
  // The dangerous ordering: ours is already mounted, so it is what getElementById finds,
  // and a copy added later would go unseen by any check that stops at the first match.
  const doc = newDoc();
  button.mount(doc, button.createButton(doc, () => {}));
  assert.ok(button.findExisting(doc), 'healthy to begin with');

  for (const selector of button.REPOSITORY_MARKER_SELECTORS.slice(1)) {
    const decoy = doc.createElement('div');
    decoy.id = button.BUTTON_ID;
    doc.querySelector(selector).append(decoy);
  }

  assert.strictEqual(button.findExisting(doc), null, 'two claimants is not a healthy page');

  button.mount(doc, button.createButton(doc, () => {}));
  let buttons = 0;
  for (const node of doc.body.walk()) if (node.id === button.BUTTON_ID) buttons += 1;
  assert.strictEqual(buttons, 1, 'the extras must be cleared');
});

test('a duplicate status is caught the same way', () => {
  const doc = newDoc();
  button.mount(doc, button.createButton(doc, () => {}));

  const decoy = doc.createElement('span');
  decoy.id = button.STATUS_ID;
  doc.querySelector(button.REPOSITORY_MARKER_SELECTORS[1]).append(decoy);

  assert.strictEqual(button.findExisting(doc), null);

  button.mount(doc, button.createButton(doc, () => {}));
  let statuses = 0;
  for (const node of doc.body.walk()) if (node.id === button.STATUS_ID) statuses += 1;
  assert.strictEqual(statuses, 1);
});

test('half a pair is not a working button', () => {
  const doc = newDoc();
  const parts = button.createButton(doc, () => {});
  button.mount(doc, parts);
  assert.ok(button.findExisting(doc));

  parts.button.remove(); // a re-render takes the button but leaves the status
  assert.strictEqual(button.findExisting(doc), null);

  button.mount(doc, button.createButton(doc, () => {}));
  let statuses = 0;
  for (const node of doc.body.walk()) if (node.id === button.STATUS_ID) statuses += 1;
  assert.strictEqual(statuses, 1, 'the orphaned status must be cleared, not duplicated');
});

test('unmount removes the button and its status together', () => {
  const doc = newDoc();
  button.mount(doc, button.createButton(doc, () => {}));
  assert.ok(doc.getElementById(button.BUTTON_ID));

  button.unmount(doc);
  assert.strictEqual(doc.getElementById(button.BUTTON_ID), null);
  assert.strictEqual(doc.getElementById(button.STATUS_ID), null);
  assert.strictEqual(doc.getElementById(button.PANEL_ID), null);
});

test('the floating control drags without launching and still supports keyboard movement', () => {
  const doc = newDoc();
  let activations = 0;
  const parts = button.createButton(doc, () => { activations += 1; });
  const win = { innerWidth: 500, innerHeight: 400 };
  parts.panel.offsetWidth = 88;
  parts.panel.offsetHeight = 88;
  button.mount(doc, parts, undefined, win);

  parts.button.dispatch('pointerdown', {
    isPrimary: true,
    button: 0,
    pointerId: 7,
    clientX: 20,
    clientY: 20,
  });
  parts.button.dispatch('pointermove', { pointerId: 7, clientX: 300, clientY: 200 });
  assert.strictEqual(parts.panel.style.left, '280px');
  assert.strictEqual(parts.panel.style.top, '180px');

  let prevented = false;
  parts.button.dispatch('pointerup', { pointerId: 7 });
  parts.button.dispatch('click', { isTrusted: true, preventDefault() { prevented = true; } });
  assert.strictEqual(activations, 0, 'releasing a drag must not launch the agent');
  assert.strictEqual(prevented, true);

  parts.button.dispatch('pointerdown', {
    isPrimary: true, button: 0, pointerId: 8, clientX: 300, clientY: 200,
  });
  parts.button.dispatch('pointerup', { pointerId: 8 });
  parts.button.dispatch('click', { isTrusted: true });
  assert.strictEqual(activations, 1, 'a later click still launches');
  parts.button.dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.strictEqual(parts.panel.style.left, '290px');
});
