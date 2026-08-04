const test = require('node:test');
const assert = require('node:assert');
const mount = require('../src/mount.js');
const button = require('../src/button.js');
const { FakeDocument, FakeWindow, FakeObserver } = require('./fake-dom.js');

const REPO_A = 'https://github.com/mdn/webextensions-examples';
const REPO_B = 'https://github.com/mozilla/policy-templates';
const NOT_A_REPO = 'https://github.com/notifications';

const setup = (href) => {
  FakeObserver.reset();
  return { doc: new FakeDocument(button.REPOSITORY_MARKER_SELECTORS), win: new FakeWindow(href) };
};

const buttonCount = (doc) => {
  let count = 0;
  for (const node of doc.body.walk()) if (node.id === button.BUTTON_ID) count += 1;
  return count;
};

test('a repository page gets a button', () => {
  const { doc, win } = setup(REPO_A);
  assert.ok(mount.sync(doc, win.location, () => {}));
  assert.strictEqual(buttonCount(doc), 1);
});

test('a page that is not a repository gets none', () => {
  const { doc, win } = setup(NOT_A_REPO);
  assert.strictEqual(mount.sync(doc, win.location, () => {}), null);
  assert.strictEqual(buttonCount(doc), 0);
});

test('syncing repeatedly never produces a second button', () => {
  const { doc, win } = setup(REPO_A);
  for (let i = 0; i < 25; i += 1) mount.sync(doc, win.location, () => {});
  assert.strictEqual(buttonCount(doc), 1);
});

test('the button carries the repository it belongs to', () => {
  const { doc, win } = setup(`${REPO_A}/blob/main/README.md`);
  const el = mount.sync(doc, win.location, () => {});
  assert.strictEqual(el.getAttribute('data-ricehub-repo'), REPO_A);
});

test('moving to a different repository replaces the button rather than keeping a stale one', () => {
  const { doc, win } = setup(REPO_A);
  mount.sync(doc, win.location, () => {});

  win.location.href = REPO_B;
  const el = mount.sync(doc, win.location, () => {});

  assert.strictEqual(buttonCount(doc), 1);
  assert.strictEqual(el.getAttribute('data-ricehub-repo'), REPO_B);
});

test('staying on the same repository leaves the existing button untouched', () => {
  const { doc, win } = setup(REPO_A);
  const first = mount.sync(doc, win.location, () => {});
  const parts = { button: first, status: doc.getElementById(button.STATUS_ID) };
  button.setState(parts, button.STATE.REQUESTED);

  win.location.href = `${REPO_A}/issues/42`;
  const second = mount.sync(doc, win.location, () => {});

  assert.strictEqual(second, first, 'the same button must survive in-repository navigation');
  assert.strictEqual(second.getAttribute('data-ricehub-state'), button.STATE.REQUESTED,
    'a status the user is reading must not be reset by unrelated navigation');
});

test('client-side navigation into, out of, and back into a repository', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });

  assert.strictEqual(buttonCount(doc), 1, 'present on arrival');

  win.navigate(NOT_A_REPO);
  assert.strictEqual(buttonCount(doc), 0, 'removed when leaving a repository');

  win.navigate(REPO_B);
  assert.strictEqual(buttonCount(doc), 1, 'back when arriving at another repository');
  assert.strictEqual(doc.getElementById(button.BUTTON_ID).getAttribute('data-ricehub-repo'), REPO_B);

  stop();
});

test('the floating panel survives a GitHub header re-render', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });
  assert.strictEqual(buttonCount(doc), 1);

  doc.replaceContent(); // GitHub swaps the header markup without changing the address
  assert.strictEqual(buttonCount(doc), 1);

  FakeObserver.fireAll();
  assert.strictEqual(buttonCount(doc), 1);
  stop();
});

test('a floating panel removed from the page is put back', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });

  doc.getElementById(button.PANEL_ID).remove();
  assert.strictEqual(buttonCount(doc), 0);
  FakeObserver.fireAll();
  assert.strictEqual(buttonCount(doc), 1);
  stop();
});

test('observer noise on an unchanged page does not multiply buttons', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });

  for (let i = 0; i < 50; i += 1) FakeObserver.fireAll();
  assert.strictEqual(buttonCount(doc), 1);
  stop();
});

test('stopping detaches both the listener and the observer', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });
  stop();

  assert.strictEqual(FakeObserver.instances.every((o) => !o.observing), true);
  assert.strictEqual((win.listeners.get('popstate') || []).length, 0);

  win.navigate(NOT_A_REPO);
  assert.strictEqual(buttonCount(doc), 1, 'after stopping, nothing reacts to navigation');
});

const statusCount = (doc) => {
  let count = 0;
  for (const node of doc.body.walk()) if (node.id === button.STATUS_ID) count += 1;
  return count;
};

test('a re-render that takes only the button is repaired without duplicating the status', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });
  assert.strictEqual(buttonCount(doc), 1);

  doc.getElementById(button.BUTTON_ID).remove();
  assert.strictEqual(buttonCount(doc), 0);
  assert.strictEqual(statusCount(doc), 1, 'the orphan is what makes this case different');

  FakeObserver.fireAll();
  assert.strictEqual(buttonCount(doc), 1, 'the pair must be rebuilt');
  assert.strictEqual(statusCount(doc), 1, 'and the orphan cleared rather than joined');
  stop();
});

test('the same repair works when only the status is taken', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });

  doc.getElementById(button.STATUS_ID).remove();
  FakeObserver.fireAll();

  assert.strictEqual(buttonCount(doc), 1);
  assert.strictEqual(statusCount(doc), 1);
  stop();
});

test('a decoy planted by the page cannot suppress the real button', () => {
  const { doc, win } = setup(REPO_A);
  const decoy = doc.createElement('div');
  decoy.id = button.BUTTON_ID;
  decoy.setAttribute('data-ricehub-repo', REPO_A);
  doc.querySelector(button.REPOSITORY_MARKER_SELECTORS[0]).append(decoy);

  const mounted = mount.sync(doc, win.location, () => {});
  assert.ok(mounted, 'the decoy must not stand in for a real button');
  assert.strictEqual(button.isOurs(mounted), true);
  assert.strictEqual(buttonCount(doc), 1, 'and it must be cleared, not left in place');
});

test('decoys planted after mounting are cleared on the next observer tick', () => {
  const { doc, win } = setup(REPO_A);
  const stop = mount.observe(win, doc, () => {}, { ObserverImpl: FakeObserver });

  const decoyButton = doc.createElement('div');
  decoyButton.id = button.BUTTON_ID;
  doc.querySelector(button.REPOSITORY_MARKER_SELECTORS[1]).append(decoyButton);
  const decoyStatus = doc.createElement('span');
  decoyStatus.id = button.STATUS_ID;
  doc.querySelector(button.REPOSITORY_MARKER_SELECTORS[2]).append(decoyStatus);

  FakeObserver.fireAll();

  assert.strictEqual(buttonCount(doc), 1);
  assert.strictEqual(statusCount(doc), 1);
  assert.strictEqual(button.isOurs(doc.getElementById(button.BUTTON_ID)), true);
  stop();
});

test('a decoy cannot make a click reach the handler', () => {
  const { doc, win } = setup(REPO_A);
  let calls = 0;
  mount.observe(win, doc, () => { calls += 1; }, { ObserverImpl: FakeObserver });

  doc.getElementById(button.BUTTON_ID).dispatch('click', { isTrusted: false });
  assert.strictEqual(calls, 0, 'a page-dispatched click must not open anything');
});

test('activation reports the repository currently shown', () => {
  const { doc, win } = setup(REPO_A);
  const seen = [];
  mount.observe(win, doc, (repo) => seen.push(repo.canonicalUrl), { ObserverImpl: FakeObserver });

  doc.getElementById(button.BUTTON_ID).dispatch('click', { isTrusted: true });
  win.navigate(REPO_B);
  doc.getElementById(button.BUTTON_ID).dispatch('click', { isTrusted: true });

  assert.deepStrictEqual(seen, [REPO_A, REPO_B]);
});
