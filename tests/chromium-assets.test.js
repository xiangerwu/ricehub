const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FAB_PATH = 'src/icons/fab/ricehub-fab-256.png';

test('Chromium can load the floating-button image on GitHub', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const css = fs.readFileSync(path.join(ROOT, 'src/content.css'), 'utf8');
  const rules = manifest.web_accessible_resources || [];

  assert.ok(fs.existsSync(path.join(ROOT, FAB_PATH)), 'the packaged FAB image must exist');
  assert.deepStrictEqual(rules, [{
    resources: [FAB_PATH],
    matches: ['https://github.com/*'],
  }]);
  assert.match(css, /background-image:\s*var\(--ricehub-button-image\)/);
  assert.doesNotMatch(css, /background-image:\s*url\(/);
});
