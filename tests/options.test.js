const test = require('node:test');
const assert = require('node:assert');
const options = require('../src/options.js');
const i18n = require('../src/options-i18n.js');
const task = require('../src/task.js');
const { FakeDocument } = require('./fake-dom.js');

function optionsDocument() {
  const doc = new FakeDocument([]);
  for (const [tag, id] of [
    ['form', 'settings-form'],
    ['select', 'destination'],
    ['select', 'language'],
    ['input', 'custom-template'],
    ['div', 'analysis-sections'],
    ['p', 'save-status'],
  ]) {
    const element = doc.createElement(tag);
    element.id = id;
    doc.body.append(element);
  }
  return doc;
}

test('options render each analysis section and read checked values', () => {
  const doc = optionsDocument();
  doc.getElementById('destination').value = 'claude';
  doc.getElementById('custom-template').value = '';
  doc.getElementById('language').value = 'en';
  options.renderSections(doc, {
    language: 'en',
    sectionIds: ['purpose', 'risks'],
    sectionPrompts: { purpose: 'Explain who needs it' },
  });

  assert.strictEqual(doc.querySelectorAll('input[name="section"]').length, task.ANALYSIS_SECTIONS.length);
  assert.deepStrictEqual(options.readForm(doc).sectionIds, ['purpose', 'risks']);
  assert.deepStrictEqual(options.readForm(doc).sectionPrompts, { purpose: 'Explain who needs it' });
});

test('options require a selection and validate custom HTTPS templates', () => {
  const doc = optionsDocument();
  doc.getElementById('destination').value = 'custom';
  doc.getElementById('custom-template').value = 'http://unsafe/?prompt={prompt}';
  doc.getElementById('language').value = 'en';
  options.renderSections(doc, { language: 'en', sectionIds: [], sectionPrompts: {} });
  assert.throws(() => options.readForm(doc), /at least one/);

  doc.querySelectorAll('input[name="section"]')[0].checked = true;
  assert.throws(() => options.readForm(doc), /HTTPS/);
});

test('language selection updates every section label and prompt placeholder', () => {
  const doc = optionsDocument();
  doc.getElementById('language').value = 'en';
  options.renderSections(doc, {
    language: 'en',
    sectionIds: ['purpose'],
    sectionPrompts: {},
  });

  doc.getElementById('language').value = 'zh-TW';
  options.updateSectionLanguage(doc);

  const purpose = task.ANALYSIS_SECTIONS.find(({ id }) => id === 'purpose');
  assert.strictEqual(doc.getElementById('section-label-purpose').textContent, purpose.labels['zh-TW']);
  assert.strictEqual(
    doc.querySelector('input[data-section-id="purpose"]').placeholder,
    purpose.prompts['zh-TW'],
  );
});

test('custom URL input is enabled only for the custom destination', () => {
  const doc = optionsDocument();
  const destination = doc.getElementById('destination');
  destination.value = 'claude';
  options.updateCustomField(doc);
  assert.strictEqual(doc.getElementById('custom-template').disabled, true);
  destination.value = 'custom';
  options.updateCustomField(doc);
  assert.strictEqual(doc.getElementById('custom-template').disabled, false);
});

test('init saves settings and reports success in the selected language', async () => {
  const doc = optionsDocument();
  const writes = [];
  const storage = {
    async get() {
      return {
        ricehubSettings: {
          destination: 'claude', language: 'zh-TW', sectionIds: ['purpose'],
        },
      };
    },
    async set(value) { writes.push(value); },
  };

  await options.init(doc, { storage: { local: storage } });
  const submit = doc.getElementById('settings-form').listeners.get('submit')[0];
  await submit({ preventDefault() {} });

  assert.strictEqual(writes.length, 1);
  assert.strictEqual(doc.getElementById('save-status').textContent, i18n.STRINGS['zh-TW']['status.saved']);
});

test('init localizes validation and storage failures', async () => {
  const doc = optionsDocument();
  let failSave = false;
  const storage = {
    async get() {
      return {
        ricehubSettings: {
          destination: 'custom',
          customTemplate: 'http://unsafe/?prompt={prompt}',
          language: 'zh-TW',
          sectionIds: ['purpose'],
        },
      };
    },
    async set() { if (failSave) throw new Error('disk unavailable'); },
  };

  await options.init(doc, { storage: { local: storage } });
  const submit = doc.getElementById('settings-form').listeners.get('submit')[0];
  await submit({ preventDefault() {} });
  assert.strictEqual(
    doc.getElementById('save-status').textContent,
    i18n.STRINGS['zh-TW']['error.customScheme'],
  );

  doc.getElementById('destination').value = 'claude';
  failSave = true;
  await submit({ preventDefault() {} });
  assert.strictEqual(
    doc.getElementById('save-status').textContent,
    i18n.STRINGS['zh-TW']['status.failed'],
  );
});
