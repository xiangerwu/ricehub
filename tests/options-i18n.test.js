const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/options-i18n.js');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'src', 'options.html'), 'utf8');

/** A document just wide enough for applyLanguage: elements keyed by their i18n key. */
function fakeDoc(keys) {
  const elements = keys.map((key) => ({
    key,
    textContent: `original:${key}`,
    getAttribute: (name) => (name === 'data-i18n' ? key : null),
  }));
  return {
    title: 'original',
    documentElement: { lang: 'en' },
    querySelectorAll: () => elements,
    getElementById: () => null,
    elements,
  };
}

const keysIn = (html) => [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);

test('every key used in the markup exists in both languages', () => {
  const used = keysIn(HTML);
  assert.ok(used.length >= 10, 'the page should be substantially translatable');

  for (const language of ['en', 'zh-TW']) {
    for (const key of used) {
      assert.ok(
        typeof i18n.STRINGS[language][key] === 'string',
        `missing ${language} string for ${key}`,
      );
    }
  }
});

test('the two languages define exactly the same keys', () => {
  assert.deepStrictEqual(
    Object.keys(i18n.STRINGS.en).sort(),
    Object.keys(i18n.STRINGS['zh-TW']).sort(),
  );
});

test('no string is left untranslated by being identical in both languages', () => {
  const identical = Object.keys(i18n.STRINGS.en).filter(
    (key) => i18n.STRINGS.en[key] === i18n.STRINGS['zh-TW'][key],
  );
  assert.deepStrictEqual(identical, [], 'these keys were never actually translated');
});

test('message() serves the strings that appear after the page is rendered', () => {
  // These have no element to rewrite when the page loads: they are produced by a save
  // or a validation failure, so they are looked up at the moment they are shown.
  for (const key of [
    'status.saved', 'status.failed', 'error.noSections', 'error.customRequired',
    'error.customPlaceholder', 'error.customInvalid', 'error.customScheme',
    'error.customPosition',
  ]) {
    assert.strictEqual(i18n.message('zh-TW', key), i18n.STRINGS['zh-TW'][key]);
    assert.strictEqual(i18n.message('en', key), i18n.STRINGS.en[key]);
    assert.notStrictEqual(i18n.message('zh-TW', key), i18n.message('en', key));
  }
});

test('message() degrades to something readable rather than to nothing', () => {
  assert.strictEqual(i18n.message('klingon', 'status.saved'), i18n.STRINGS.en['status.saved']);
  assert.strictEqual(i18n.message('en', 'no.such.key'), 'no.such.key');
});

test('applyLanguage replaces text and sets the document language', () => {
  const doc = fakeDoc(keysIn(HTML));
  i18n.applyLanguage(doc, 'zh-TW');

  assert.strictEqual(doc.documentElement.lang, 'zh-Hant-TW');
  assert.strictEqual(doc.title, i18n.STRINGS['zh-TW']['page.title']);
  for (const element of doc.elements) {
    assert.strictEqual(element.textContent, i18n.STRINGS['zh-TW'][element.key]);
  }
});

test('an unknown language falls back to English rather than blanking the page', () => {
  const doc = fakeDoc(keysIn(HTML));
  i18n.applyLanguage(doc, 'klingon');

  assert.strictEqual(doc.documentElement.lang, 'en');
  for (const element of doc.elements) {
    assert.strictEqual(element.textContent, i18n.STRINGS.en[element.key]);
  }
});

test('markup keeps the hooks options.js depends on', () => {
  for (const hook of [
    'id="settings-form"', 'id="destination"', 'id="custom-template"',
    'id="language"', 'id="analysis-sections"', 'id="save-status"',
    'name="destination"', 'name="customTemplate"',
  ]) {
    assert.ok(HTML.includes(hook), `markup lost ${hook}`);
  }
  assert.ok(HTML.includes('options-i18n.js'), 'the i18n script must be loaded');
  assert.ok(HTML.includes('options.css'), 'the stylesheet must be linked');
});

test('start falls back to the select value when storage is unavailable', async () => {
  const doc = fakeDoc(keysIn(HTML));
  const listeners = [];
  const select = {
    value: 'zh-TW',
    addEventListener: (type, handler) => listeners.push([type, handler]),
  };
  doc.getElementById = (id) => (id === 'language' ? select : null);

  const failingStorage = { storage: { local: {} } };
  const Settings = { load: async () => { throw new Error('unavailable'); } };

  const language = await i18n.start(doc, failingStorage, Settings);
  assert.strictEqual(language, 'zh-TW');
  assert.strictEqual(doc.title, i18n.STRINGS['zh-TW']['page.title']);
  assert.deepStrictEqual(listeners.map(([type]) => type), ['change']);
});

test('changing the selector re-applies the interface language', async () => {
  const doc = fakeDoc(keysIn(HTML));
  let onChange;
  const select = {
    value: 'en',
    addEventListener: (type, handler) => { if (type === 'change') onChange = handler; },
  };
  doc.getElementById = (id) => (id === 'language' ? select : null);

  await i18n.start(doc, { storage: { local: {} } }, { load: async () => ({ language: 'en' }) });
  assert.strictEqual(doc.title, i18n.STRINGS.en['page.title']);

  select.value = 'zh-TW';
  onChange();
  assert.strictEqual(doc.title, i18n.STRINGS['zh-TW']['page.title']);
  assert.strictEqual(doc.documentElement.lang, 'zh-Hant-TW');
});
