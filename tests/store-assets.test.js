const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const expected = {
  'icon-128.png': [128, 128],
  'screenshot-github-1280x800.png': [1280, 800],
  'screenshot-settings-1280x800.png': [1280, 800],
  'promo-small-440x280.png': [440, 280],
  'promo-marquee-1400x560.png': [1400, 560],
};
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

test('store PNG assets have real PNG content and their required dimensions', () => {
  for (const [name, [width, height]] of Object.entries(expected)) {
    const bytes = fs.readFileSync(path.join(root, 'store-assets', name));
    assert.deepStrictEqual(bytes.subarray(0, 8), pngSignature, `${name} signature`);
    assert.strictEqual(bytes.readUInt32BE(16), width, `${name} width`);
    assert.strictEqual(bytes.readUInt32BE(20), height, `${name} height`);
  }
});
