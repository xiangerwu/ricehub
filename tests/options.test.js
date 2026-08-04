const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const options = require('../src/options.js');
const i18n = require('../src/options-i18n.js');
const task = require('../src/task.js');
const { FakeDocument } = require('./fake-dom.js');

test('the settings page uses a larger responsive dashboard layout', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'options.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'options.css'), 'utf8');

  for (const name of ['destination-card', 'language-card', 'appearance-card', 'sections-card']) {
    assert.ok(html.includes(name), `missing dashboard area: ${name}`);
  }
  // A floor, not an exact size. Pinning the exact value makes every readability tweak a
  // test failure, while a floor still catches the regression that matters: text shrinking
  // back to something hard to read.
  const bodyFont = css.match(/body\s*\{[^}]*font:\s*400 (\d+(?:\.\d+)?)px\/(\d+(?:\.\d+)?)/s);
  assert.ok(bodyFont, 'the body font shorthand must stay parseable');
  assert.ok(Number(bodyFont[1]) >= 16, `body text is ${bodyFont[1]}px, below the 16px floor`);
  assert.ok(Number(bodyFont[2]) >= 1.4, 'line height must stay at or above 1.4');

  // Every declared size must clear the floor too, so no corner of the page stays small.
  for (const [, size] of css.matchAll(/font-size:\s*(\d+)px;/g)) {
    assert.ok(Number(size) >= 14, `a ${size}px rule is below the 14px floor`);
  }
  assert.match(css, /#settings-form\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:/s);
  // The short cards are stacked in their own column. Spanning rows instead made the
  // browser hand the tall analysis card's extra height to the row above it, which left a
  // gap under the destination card.
  assert.ok(html.includes('class="stack"'), 'the short cards need their own column');
  assert.match(css, /\.stack\s*\{[^}]*display:\s*grid;[^}]*align-content:\s*start;/s);
  assert.ok(!/grid-row:\s*1\s*\/\s*span 2/.test(css), 'row spanning couples column heights');
  // The save action sits in the last column, bottom row.
  // The action bar spans the form rather than sitting in one column, where it read as
  // a stray box beside empty space.
  assert.match(css, /\.actions\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*justify-content:\s*flex-end;/s);
  assert.match(css, /#analysis-sections\s*\{[^}]*container-type:\s*inline-size;/s);
  assert.match(css, /@container \(width <= \d+px\)/, 'the analysis grid must fold on narrow columns');
  assert.match(css, /@media \(width <= 620px\)[^{]*\{[\s\S]*?#settings-form\s*\{[^}]*grid-template-columns:\s*1fr;/);
});

function optionsDocument() {
  const doc = new FakeDocument([]);
  for (const [tag, id] of [
    ['form', 'settings-form'],
    ['select', 'destination'],
    ['select', 'language'],
    ['input', 'custom-template'],
    ['input', 'button-size'],
    ['input', 'claude-color'],
    ['input', 'codex-color'],
    ['input', 'custom-color'],
    ['output', 'button-size-value'],
    ['div', 'analysis-sections'],
    ['p', 'save-status'],
  ]) {
    const element = doc.createElement(tag);
    element.id = id;
    doc.body.append(element);
  }
  doc.getElementById('button-size').value = '88';
  doc.getElementById('claude-color').value = '#d97757';
  doc.getElementById('codex-color').value = '#10a37f';
  doc.getElementById('custom-color').value = '#8250df';
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
  assert.strictEqual(options.readForm(doc).buttonSize, '88');
  assert.strictEqual(options.readForm(doc).claudeColor, '#d97757');
  assert.strictEqual(options.readForm(doc).codexColor, '#10a37f');
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
    doc.querySelector('[data-section-id="purpose"]').placeholder,
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
          buttonSize: 112, claudeColor: '#123456', codexColor: '#654321',
        },
      };
    },
    async set(value) { writes.push(value); },
  };

  await options.init(doc, { storage: { local: storage } });
  assert.strictEqual(doc.getElementById('button-size').value, '112');
  assert.strictEqual(doc.getElementById('button-size-value').textContent, '112 px');
  assert.strictEqual(doc.getElementById('claude-color').value, '#123456');
  assert.strictEqual(doc.getElementById('codex-color').value, '#654321');
  doc.getElementById('button-size').value = '120';
  doc.getElementById('button-size').dispatch('input');
  assert.strictEqual(doc.getElementById('button-size-value').textContent, '120 px');
  const submit = doc.getElementById('settings-form').listeners.get('submit')[0];
  await submit({ preventDefault() {} });

  assert.strictEqual(writes.length, 1);
  assert.strictEqual(writes[0].ricehubSettings.buttonSize, 120);
  assert.strictEqual(writes[0].ricehubSettings.claudeColor, '#123456');
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
