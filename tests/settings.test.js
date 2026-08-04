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
  });
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
