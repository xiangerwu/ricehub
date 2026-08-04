const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

test('Chrome-only globals start every browser entry point', () => {
  const cases = [
    {
      file: 'src/content.js',
      globals: {
        RiceHubTask: {},
        RiceHubDestinations: {},
        RiceHubButton: {},
        RiceHubMount: {},
      },
    },
    {
      file: 'src/options.js',
      globals: { RiceHubTask: {}, RiceHubDestinations: {} },
    },
    { file: 'src/options-i18n.js', globals: {} },
  ];

  for (const { file, globals } of cases) {
    const local = {};
    let loadedFrom;
    const context = {
      ...globals,
      chrome: {
        runtime: {
          getURL(resource) {
            return `chrome-extension://ricehub/${resource}`;
          },
        },
        storage: { local },
      },
      document: { getElementById: () => null },
      RiceHubSettings: {
        load(storageArea) {
          loadedFrom = storageArea;
          return new Promise(() => {});
        },
      },
    };

    vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
    assert.strictEqual(loadedFrom, local, `${file} must start with chrome.storage.local`);
  }
});

test('Chrome manifest targets Promise-capable Storage APIs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3);
  assert.strictEqual(manifest.minimum_chrome_version, '95');
});
