const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Bilingual documentation fails in one predictable way: one language gets updated and the
// other quietly goes stale, so the reader of the neglected language is given instructions
// that no longer work. These checks compare the two files on everything that is supposed
// to be identical regardless of language, which is where that drift shows up first.

const root = path.join(__dirname, '..');
const EN = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const ZH = fs.readFileSync(path.join(root, 'README.zh-TW.md'), 'utf8');

const headings = (text) => text.match(/^#{2,3} /gm) || [];
const codeSpans = (text) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
const links = (text) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
const fences = (text) => [...text.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((m) => m[2].trim());

test('both languages exist and are substantial', () => {
  assert.ok(EN.length > 500, 'English README is too short to be complete');
  assert.ok(ZH.length > 500, 'Chinese README is too short to be complete');
});

test('each language links to the other', () => {
  assert.ok(EN.includes('README.zh-TW.md'), 'English must offer the Chinese version');
  assert.ok(ZH.includes('README.md'), 'Chinese must offer the English version');
});

test('both have the same section structure', () => {
  assert.deepStrictEqual(
    headings(ZH),
    headings(EN),
    'a section was added or removed in one language only',
  );
});

test('both name the same commands, paths, and identifiers', () => {
  // Code spans are language-independent by definition: a command or a path is the same
  // string in both files, so any difference here is a translation that drifted.
  const en = new Set(codeSpans(EN));
  const zh = new Set(codeSpans(ZH));

  const missingFromZh = [...en].filter((value) => !zh.has(value));
  const missingFromEn = [...zh].filter((value) => !en.has(value));

  assert.deepStrictEqual(missingFromZh, [], 'present in English, missing from Chinese');
  assert.deepStrictEqual(missingFromEn, [], 'present in Chinese, missing from English');
});

test('both point at the same files and documents', () => {
  assert.deepStrictEqual(
    links(ZH).filter((href) => href !== 'README.md').sort(),
    links(EN).filter((href) => href !== 'README.zh-TW.md').sort(),
    'the two languages link to different places',
  );
});

test('code blocks name the same commands and paths', () => {
  // Only the first token of each line is compared. A layout block is a path followed by a
  // description: the path must match across languages, and the description beside it must
  // not, or it was never translated.
  const tokens = (text) =>
    fences(text).map((block) =>
      block.split('\n').map((line) => line.trim().split(/\s+/)[0]).join(' '),
    );

  assert.deepStrictEqual(tokens(ZH), tokens(EN), 'a command or path differs between languages');
});

test('the troubleshooting steps have not diverged in count', () => {
  const steps = (text) => {
    const section = text.split(/^## /m).find((part) => /Troubleshooting|疑難排解/.test(part));
    return section ? (section.match(/^\d+\. /gm) || []).length : 0;
  };
  assert.ok(steps(EN) >= 4, 'English troubleshooting lost its steps');
  assert.strictEqual(steps(ZH), steps(EN), 'a troubleshooting step exists in one language only');
});

test('the design constraints list has not diverged in count', () => {
  const bullets = (text) => {
    const section = text.split(/^## /m).find((part) => /Design Constraints|設計約束/.test(part));
    return section ? (section.match(/^- /gm) || []).length : 0;
  };
  assert.ok(bullets(EN) >= 5);
  assert.strictEqual(bullets(ZH), bullets(EN), 'a constraint exists in one language only');
});
