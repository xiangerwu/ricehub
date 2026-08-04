const test = require('node:test');
const assert = require('node:assert');
const settings = require('../src/settings.js');

test('settings normalize unknown values without retaining extra fields', () => {
  assert.deepStrictEqual(settings.normalizeSettings({
    destination: 'invalid',
    customTemplate: 42,
    sectionIds: ['risks', 'unknown', 'risks'],
    secret: 'must not persist',
  }), {
    destination: 'claude',
    customTemplate: '',
    language: 'en',
    sectionIds: ['risks'],
    sectionPrompts: {},
    buttonSize: 88,
    claudeColor: '#d97757',
    codexColor: '#10a37f',
    customColor: '#8250df',
    buttonPosition: null,
  });
});

test('button appearance is bounded and invalid colors fall back safely', () => {
  assert.deepStrictEqual(
    settings.normalizeSettings({ buttonSize: '999', claudeColor: '#A1B2C3', codexColor: '#D4E5F6' }),
    {
      ...settings.normalizeSettings(),
      buttonSize: 160,
      claudeColor: '#a1b2c3',
      codexColor: '#d4e5f6',
    },
  );
  assert.strictEqual(settings.normalizeSettings({ buttonSize: 1 }).buttonSize, 44);
  // A colour name is not a hex value, so it is refused rather than passed to CSS, where
  // an unparseable value would silently leave the ring invisible.
  assert.strictEqual(settings.normalizeSettings({ claudeColor: 'red' }).claudeColor, '#d97757');
  assert.strictEqual(
    settings.normalizeSettings({ codexColor: 'rgb(0,0,0)' }).codexColor,
    '#10a37f',
  );

  // The colour the button shows is whichever destination is actually selected.
  const chosen = settings.normalizeSettings({ destination: 'custom', customColor: '#abcdef' });
  assert.strictEqual(settings.destinationColor(chosen), '#abcdef');
  assert.strictEqual(
    settings.destinationColor(settings.normalizeSettings({ destination: 'codex' })),
    '#10a37f',
  );
});

test('settings keep only supported language and per-section prompts', () => {
  assert.deepStrictEqual(settings.normalizeSettings({
    language: 'zh-TW',
    sectionPrompts: {
      purpose: '  自訂分析目的  ',
      risks: 'x'.repeat(800),
      unknown: 'discard me',
    },
  }).sectionPrompts, {
    purpose: '自訂分析目的',
    risks: 'x'.repeat(500),
  });
  assert.strictEqual(settings.normalizeSettings({ language: 'xx' }).language, 'en');
});

test('an empty section selection falls back to all sections', () => {
  assert.deepStrictEqual(settings.normalizeSettings({ sectionIds: [] }).sectionIds, settings.ALL_SECTION_IDS);
});

test('load and save use one storage key and normalized data', async () => {
  const calls = [];
  const storage = {
    async get(key) {
      assert.strictEqual(key, settings.STORAGE_KEY);
      return { [key]: { destination: 'codex', sectionIds: ['purpose'] } };
    },
    async set(value) { calls.push(value); },
  };

  assert.strictEqual((await settings.load(storage)).destination, 'codex');
  const saved = await settings.save(storage, { destination: 'codex', sectionIds: ['purpose'] });
  assert.deepStrictEqual(calls, [{ [settings.STORAGE_KEY]: saved }]);
});
