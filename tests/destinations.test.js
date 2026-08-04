const test = require('node:test');
const assert = require('node:assert');
const destinations = require('../src/destinations.js');

test('desktop destination URLs carry one encoded prompt', () => {
  const prompt = 'Review a/b?x=1 & report';
  const claude = destinations.buildLaunchUrl({ destination: 'claude' }, prompt);
  const codex = destinations.buildLaunchUrl({ destination: 'codex' }, prompt);

  // The prompt is followed by launch padding, so compare everything up to it. Encoding
  // the prompt itself is what this test is about; the padding has its own test.
  assert.ok(claude.startsWith(`claude://claude.ai/new?q=${encodeURIComponent(prompt)}`));
  assert.ok(codex.startsWith(`codex://threads/new?prompt=${encodeURIComponent(prompt)}`));
  assert.strictEqual(decodeURIComponent(claude.split('?q=')[1]).trimEnd(), prompt);
});

test('custom destination accepts one HTTPS placeholder outside the authority', () => {
  const template = 'https://agent.example/new?prompt={prompt}';
  assert.strictEqual(destinations.validateCustomTemplate(template), template);
  assert.strictEqual(
    destinations.buildLaunchUrl({ destination: 'custom', customTemplate: template }, 'a b'),
    'https://agent.example/new?prompt=a%20b',
  );
});

test('custom destination rejects unsafe or ambiguous templates', () => {
  for (const template of [
    'http://agent.example/?prompt={prompt}',
    'https://user:secret@agent.example/?prompt={prompt}',
    'https://{prompt}.example/new',
    'https://agent.example/new',
    'https://agent.example/?a={prompt}&b={prompt}',
    'not a url {prompt}',
  ]) {
    assert.throws(() => destinations.validateCustomTemplate(template), /custom URL|prompt/);
  }
});

test('unknown destinations and empty prompts fail closed', () => {
  assert.throws(() => destinations.buildLaunchUrl({ destination: 'other' }, 'prompt'), /unknown/);
  assert.throws(() => destinations.buildLaunchUrl({ destination: 'claude' }, ''), /required/);
});

test('each desktop launch is textually distinct so the agent does not treat it as a repeat', () => {
  // Measured behaviour: opening the same deep link twice leaves the composer empty the
  // second time. These assertions pin the smallest difference that avoids it.
  const settings = { destination: destinations.DESTINATION.CLAUDE };
  const first = destinations.buildLaunchUrl(settings, 'analyse this', 1000);
  const second = destinations.buildLaunchUrl(settings, 'analyse this', 1001);

  assert.notStrictEqual(first, second, 'two launches must not produce the same link');

  const promptOf = (url) => decodeURIComponent(url.split('?q=')[1]);
  assert.strictEqual(promptOf(first).trimEnd(), 'analyse this');
  assert.strictEqual(promptOf(second).trimEnd(), 'analyse this');
  assert.notStrictEqual(promptOf(first), promptOf(second));
});

test('the padding stays small and never empty', () => {
  for (const now of [0, 1, 16, 17, 1e12, -5, Number.NaN]) {
    const padding = destinations.launchPadding(now);
    assert.match(padding, /^ +$/, 'padding must be whitespace only');
    assert.ok(padding.length >= 1 && padding.length <= destinations.NONCE_RANGE);
  }
});

test('a custom HTTPS destination is left exactly as configured', () => {
  // Someone else's endpoint receives what they asked for, not our workaround.
  const settings = {
    destination: destinations.DESTINATION.CUSTOM,
    customTemplate: 'https://example.com/new?q={prompt}',
  };
  assert.strictEqual(
    destinations.buildLaunchUrl(settings, 'analyse this', 1),
    destinations.buildLaunchUrl(settings, 'analyse this', 2),
  );
  assert.ok(destinations.buildLaunchUrl(settings, 'analyse this', 1).endsWith('analyse%20this'));
});
