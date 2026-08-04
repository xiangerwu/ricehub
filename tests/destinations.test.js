const test = require('node:test');
const assert = require('node:assert');
const destinations = require('../src/destinations.js');

test('desktop destination URLs carry one encoded prompt', () => {
  const prompt = 'Review a/b?x=1 & report';
  const claude = destinations.buildLaunchUrl({ destination: 'claude' }, prompt);
  const codex = destinations.buildLaunchUrl({ destination: 'codex' }, prompt);

  assert.strictEqual(claude, `claude://claude.ai/new?q=${encodeURIComponent(prompt)}`);
  assert.strictEqual(codex, `codex://threads/new?prompt=${encodeURIComponent(prompt)}`);
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
