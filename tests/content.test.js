const test = require('node:test');
const assert = require('node:assert');
const content = require('../src/content.js');
const button = require('../src/button.js');
const settings = require('../src/settings.js');
const { FakeDocument, FakeWindow, FakeObserver } = require('./fake-dom.js');

const REPO = 'https://github.com/mdn/webextensions-examples';

function browserStub(value) {
  const listeners = new Set();
  return {
    runtime: {
      getURL(resource) { return `chrome-extension://ricehub/${resource}`; },
    },
    storage: {
      local: { async get() { return { [settings.STORAGE_KEY]: value }; } },
      onChanged: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); },
      },
    },
    listeners,
  };
}

function stateParts() {
  const attributes = new Map();
  return {
    button: {
      textContent: '',
      getAttribute(name) { return attributes.get(name) || null; },
      setAttribute(name, value) { attributes.set(name, value); this[name] = value; },
    },
    status: { textContent: '' },
  };
}

test('trusted click navigates the current top-level context for Claude Desktop', async () => {
  FakeObserver.reset();
  const doc = new FakeDocument(button.REPOSITORY_MARKER_SELECTORS);
  doc.title = 'MDN examples';
  const win = new FakeWindow(REPO);
  win.top = win;
  win.open = () => { throw new Error('desktop protocols must not use a popup'); };
  const browserApi = browserStub({ destination: 'claude', sectionIds: ['purpose'] });

  const stop = await content.start(win, doc, browserApi, { ObserverImpl: FakeObserver });
  doc.getElementById(button.BUTTON_ID).dispatch('click', { isTrusted: true });

  assert.ok(win.location.href.startsWith('claude://claude.ai/new?q='));
  assert.strictEqual(
    doc.getElementById(button.BUTTON_ID).getAttribute('data-ricehub-state'),
    button.STATE.REQUESTED,
  );
  stop();
  assert.strictEqual(browserApi.listeners.size, 0);
});

test('trusted Codex click uses the native link default action with the full prompt', async () => {
  FakeObserver.reset();
  const doc = new FakeDocument(button.REPOSITORY_MARKER_SELECTORS);
  doc.title = 'MDN examples';
  const win = new FakeWindow(REPO);
  const originalHref = win.location.href;
  win.top = win;
  win.open = () => { throw new Error('Codex must use the native link'); };
  const stop = await content.start(
    win,
    doc,
    browserStub({ destination: 'codex', sectionIds: ['purpose'] }),
    { ObserverImpl: FakeObserver },
  );
  let prevented = false;

  const action = doc.getElementById(button.BUTTON_ID);
  action.dispatch('click', { isTrusted: true, preventDefault() { prevented = true; } });

  assert.strictEqual(prevented, false);
  assert.ok(action.href.startsWith('codex://threads/new?prompt='));
  assert.ok(decodeURIComponent(action.href).includes('What the project is for'));
  assert.strictEqual(win.location.href, originalHref);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.strictEqual(action.href, '#', 'the full prompt must not remain in the GitHub DOM');
  stop();
});

test('page-dispatched clicks do not request a URL', async () => {
  FakeObserver.reset();
  const doc = new FakeDocument(button.REPOSITORY_MARKER_SELECTORS);
  const win = new FakeWindow(REPO);
  let opened = 0;
  win.open = () => { opened += 1; };
  const stop = await content.start(win, doc, browserStub({}), { ObserverImpl: FakeObserver });

  doc.getElementById(button.BUTTON_ID).dispatch('click', { isTrusted: false });
  assert.strictEqual(opened, 0);
  stop();
});

test('stored language localizes the panel and live storage changes update it', async () => {
  FakeObserver.reset();
  const doc = new FakeDocument(button.REPOSITORY_MARKER_SELECTORS);
  const win = new FakeWindow(REPO);
  const cssVariables = new Map();
  doc.documentElement = {
    style: { setProperty(name, value) { cssVariables.set(name, value); } },
  };
  const browserApi = browserStub({
    language: 'zh-TW', buttonSize: 112, destination: 'codex', codexColor: '#123456',
  });
  const stop = await content.start(win, doc, browserApi, { ObserverImpl: FakeObserver });
  const action = doc.getElementById(button.BUTTON_ID);

  assert.strictEqual(action.textContent, '');
  assert.ok(action.getAttribute('aria-label').includes(button.LABELS['zh-TW'][button.STATE.IDLE]));
  assert.strictEqual(cssVariables.get('--ricehub-button-size'), '112px');
  assert.strictEqual(cssVariables.get('--ricehub-button-background'), '#123456');
  assert.strictEqual(
    cssVariables.get('--ricehub-button-image'),
    'url("chrome-extension://ricehub/src/icons/fab/ricehub-fab-256.png")',
  );
  for (const listener of browserApi.listeners) {
    listener({
      [settings.STORAGE_KEY]: {
        newValue: { language: 'en', buttonSize: 64, destination: 'custom', customColor: '#abcdef' },
      },
    }, 'local');
  }
  assert.ok(action.getAttribute('aria-label').includes(button.LABELS.en[button.STATE.IDLE]));
  assert.strictEqual(cssVariables.get('--ricehub-button-size'), '64px');
  assert.strictEqual(cssVariables.get('--ricehub-button-background'), '#abcdef');
  stop();
});

test('a synchronously rejected desktop navigation reports failure without opening a popup', () => {
  let popupCalls = 0;
  const location = {};
  Object.defineProperty(location, 'href', {
    set() { throw new Error('unsupported protocol'); },
  });
  const parts = stateParts();
  const activate = content.createActivation(
    { top: { location }, open() { popupCalls += 1; } },
    { title: 'x' },
    () => ({ destination: 'claude', sectionIds: ['purpose'] }),
  );

  activate({ owner: 'a', repo: 'b' }, parts);
  assert.strictEqual(parts.button['data-ricehub-state'], button.STATE.FAILED);
  assert.strictEqual(popupCalls, 0);
});

test('a blocked custom HTTPS popup reports failure', () => {
  const parts = stateParts();
  const activate = content.createActivation(
    { open() { return null; } },
    { title: 'x' },
    () => ({
      destination: 'custom',
      customTemplate: 'https://agent.example/?prompt={prompt}',
      sectionIds: ['purpose'],
    }),
  );

  activate({ owner: 'a', repo: 'b' }, parts);
  assert.strictEqual(parts.button['data-ricehub-state'], button.STATE.FAILED);
  assert.ok(parts.status.textContent.includes('popup blocked'));
});

test('an allowed custom HTTPS popup loses its opener before navigation', () => {
  const events = [];
  const popup = {
    opener: 'initial',
    location: { replace(url) { events.push(['navigate', url, popup.opener]); } },
  };
  const requested = content.requestOpen(
    { open(...args) { events.push(['open', ...args]); return popup; } },
    { destination: 'custom' },
    'https://agent.example/new?prompt=x',
  );

  assert.strictEqual(requested, true);
  assert.deepStrictEqual(events, [
    ['open', '', '_blank'],
    ['navigate', 'https://agent.example/new?prompt=x', null],
  ]);
});

test('launch construction failures become a truthful failed state', () => {
  const doc = { title: 'x' };
  const win = { open() { throw new Error('must not be reached'); } };
  const parts = stateParts();
  const activate = content.createActivation(win, doc, () => ({
    destination: 'custom', customTemplate: 'http://unsafe/{prompt}', sectionIds: ['purpose'],
  }));

  activate({ owner: 'a', repo: 'b' }, parts);
  assert.strictEqual(parts.button['data-ricehub-state'], button.STATE.FAILED);
  assert.ok(parts.status.textContent.includes('check extension settings'));
});
