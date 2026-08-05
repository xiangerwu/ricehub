const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('manifest has only the required host and permission scope', () => {
  assert.strictEqual(manifest.manifest_version, 3);
  assert.deepStrictEqual(manifest.permissions, ['storage']);
  assert.deepStrictEqual(manifest.content_scripts[0].matches, ['https://github.com/*']);
  assert.ok(!JSON.stringify(manifest).includes('<all_urls>'));
});

test('manifest exposes English and Traditional Chinese store metadata', () => {
  assert.strictEqual(manifest.name, '__MSG_extensionName__');
  assert.strictEqual(manifest.description, '__MSG_extensionDescription__');
  assert.strictEqual(manifest.default_locale, 'en');

  for (const locale of ['en', 'zh_TW']) {
    const messages = JSON.parse(
      fs.readFileSync(path.join(root, '_locales', locale, 'messages.json'), 'utf8'),
    );
    assert.strictEqual(messages.extensionName.message, 'RiceHub');
    assert.ok(messages.extensionDescription.message.trim(), locale);
  }
});

test('Firefox signing metadata declares a stable ID and transmitted page data', () => {
  assert.strictEqual(manifest.browser_specific_settings.gecko.id, 'ricehub@xiangerwu.github.io');
  assert.deepStrictEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions.required,
    ['browsingActivity', 'websiteContent'],
  );
});

test('every manifest and options-page local resource exists', () => {
  const resources = [
    manifest.options_ui.page,
    ...manifest.content_scripts[0].css,
    ...manifest.content_scripts[0].js,
  ];
  for (const resource of resources) {
    assert.strictEqual(fs.existsSync(path.join(root, resource)), true, resource);
  }

  const html = fs.readFileSync(path.join(root, manifest.options_ui.page), 'utf8');
  for (const script of ['task.js', 'destinations.js', 'settings.js', 'options.js']) {
    assert.ok(html.includes(`src="${script}"`), script);
  }
});
