# ARCHITECTURE

Written for whoever changes this code next, human or AI agent. It states what the
extension does, how the pieces fit, and which rules are load-bearing. Where a decision
looks arbitrary, the reason is given, because a rule without its reason gets deleted by
the next person who finds it inconvenient.

The README introduces the product. This file is the one to read before editing.

## What RiceHub is

A browser extension that turns the GitHub repository page you are viewing into a
structured analysis prompt and hands that prompt to an AI agent: Claude Desktop, Codex
Desktop, or an HTTPS address you configure.

The work is in the prompt. Opening the agent is the last step, not the point.

## What it deliberately does not do

These are not missing features. Each one is a boundary, and code that crosses one is a
defect regardless of how well it works.

- It does not fetch repository content, read the GitHub API, or call any network endpoint.
- It does not submit the prompt or retrieve a result. The user presses Enter themselves.
- It does not store repository URLs, prompts, page titles, results, or credentials.
  `storage` holds configuration only.
- It does not claim success on delivery. Handing a URL to a protocol handler is
  unobservable from the page, so the strongest state is "Open request sent".
- It does not request `<all_urls>` or any host permission beyond `https://github.com/*`.
- It does not classify repository visibility, and must not: a private repository's URL is
  as sensitive as its content, and the extension cannot tell them apart.

## Runtime shape

No dependencies, no build step, no bundler, no transpiler. Files ship exactly as written.

Every module is an IIFE that assigns to a global (`RiceHubTask`, `RiceHubButton`, …) and
also to `module.exports` when one exists. That dual export is what lets the same file run
as a content script in the browser and as a CommonJS module under `node --test`, with no
build step in between. Keep it when adding a module:

```js
(function (root) {
  'use strict';
  const api = { /* … */ };
  root.RiceHubThing = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
```

Content scripts load in the order listed in `manifest.json`, and that order is the
dependency order. A module may only use globals declared before it in that list.

Manifest V3. Firefox and Chromium share one manifest; `browser_specific_settings.gecko`
carries the add-on ID and the Firefox data-collection declaration.

## Module map

Dependencies point downward only. Nothing below reaches up.

```text
content.js      wiring, browser APIs, appearance, activation
mount.js        when the button should exist; SPA navigation
button.js       the injected DOM, its states, dragging
settings.js     configuration schema and normalization
destinations.js launch URL construction and custom-template validation
task.js         URL parsing and prompt assembly
```

**`task.js`** is pure. Given a URL and a title it decides whether the page is a repository
and what the prompt says. No DOM, no browser API, no clock. Everything security-critical
about the prompt lives here.

**`destinations.js`** is pure. It turns a prompt plus settings into one launch URL, and it
is the only place that decides whether a custom template is acceptable.

**`settings.js`** owns the shape of stored configuration. `normalizeSettings` is total: it
accepts anything, including a hostile or corrupted storage value, and returns a valid
settings object. Stored settings are untrusted input.

**`button.js`** owns everything injected into the page: the panel, the anchor, the
screen-reader status line, drag handling, and the label text. It never decides *whether*
to appear.

**`mount.js`** decides whether the button should exist right now, and keeps that true
across GitHub's client-side navigation.

**`content.js`** is the only module that touches `browser`/`chrome` APIs, and the only one
that reads `document.title` or the live location. Effects live here, at the outer seam.

`options.js` and `options-i18n.js` are the settings page and its strings. The options page
shares `task.js`, `settings.js`, and `destinations.js` with the content script, which is
why validation cannot drift between the two.

## Flow

**On a GitHub page.** `content.js` loads settings, sets three CSS custom properties on
`documentElement` (size, destination colour, button image URL), then hands control to
`mount.observe`. That watches `popstate` and a `MutationObserver` on `body`, because
GitHub navigates without reloading. On every change it re-parses the location: not a
repository, the button is removed; a different repository, the button is rebuilt; the same
repository, the existing button is left alone.

**On a click.** `content.js` builds the prompt from the repository reference and the page
title, builds the launch URL, then either navigates (Claude), sets the anchor's `href` and
lets the trusted click follow it (Codex), or opens a window (custom HTTPS). The button
moves to `requested` or `failed`, and the status line says which.

**On a drag.** The position is written to storage only when the drag settles, merged into
the settings already in hand. Writing on every `pointermove` would hit storage dozens of
times a second for a value nobody reads until the page reloads.

## Trust boundaries

Three inputs are untrusted, and all three are hostile in the threat model:

1. **The page.** GitHub's DOM, the page title, and the URL are attacker-influenced: a
   repository name and a repository description are whatever their owner typed.
2. **Stored settings.** Another extension, a synced profile, or a corrupted write can put
   anything in `storage.local`.
3. **The prompt's own content**, once it reaches the agent.

The rules that follow from that:

- **No HTML is ever constructed from a string.** `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, and `document.write` appear nowhere in `src/`, and must not. Text
  goes in through `textContent`; attributes through `setAttribute`.
- **Repository names are pattern-matched, not escaped.** `parseRepo` accepts
  `[A-Za-z0-9._-]+` only, rejects credentials, ports, and `//` in the path, rejects `.`,
  `..`, and a trailing `.git`, and reduces any deeper path to the repository root.
- **`requireRepo` re-parses rather than re-checks.** It rebuilds a URL from the reference
  and runs it back through `parseRepo`. A second copy of the rules would drift from the
  first; this one cannot.
- **Untrusted text is fenced, and the rule is stated before the fence.** The prompt says
  what to distrust *before* the `--- DATA ---` block, so an injected instruction inside it
  is already covered by a rule the agent has read. `sanitizeText` strips control
  characters, collapses hyphen runs that could forge a fence, collapses whitespace, and
  truncates, so nothing inside the block can add a line or close it early.
- **Custom destinations are HTTPS only**, with no credentials, exactly one `{prompt}`, and
  the placeholder outside the authority. That last rule is the one that matters: a
  placeholder in the host would let a prompt choose the server it is sent to.
- **Only trusted clicks act.** A synthesised `click` event is ignored, so the page cannot
  fire the button by script.
- **The button verifies it owns what it finds.** Nodes are tracked in a `WeakSet`, and
  duplicate IDs are treated as hostile rather than merged, so a page-planted decoy with
  our ID cannot be adopted. The generated `href` is cleared in the next task after a Codex
  launch, so the prompt does not sit in GitHub's DOM.

## Measured constraints

Numbers that look arbitrary and are not. Each was measured; do not tune them by feel.

**Prompt limit: 7,500 encoded characters.** Windows passes a protocol URL to its handler
as a command line, bounded near 8,191 characters. The check runs on
`encodeURIComponent(prompt).length`, not on the prompt's length, because a Latin character
costs 1 and a CJK character costs 9 (three UTF-8 bytes, each `%XX`). A character-count
limit bounds English and lets Chinese through: a page of Chinese questions reaches roughly
35,000 URL characters while sitting inside a 5,000-character prompt.

**Trailing whitespace on desktop launches.** Measured 2026-08-04: opening a desktop deep
link, clearing the composer, and opening the identical link again leaves the composer
empty; the same link with trailing spaces fills it. The agent treats an identical link as
a repeat. Each launch is therefore made textually distinct by 1–17 trailing spaces derived
from the clock. Custom HTTPS destinations are left exactly as configured — padding someone
else's endpoint is not this extension's decision.

**Drag threshold: 10px.** A press drifts a few pixels on a trackpad, and the click after a
drag is swallowed on purpose, so a tight threshold turns an imprecise press into a press
that does nothing. This is comfort, not a fix for the empty-composer report above.

**One clamp, in `placePanel`.** Dragging and restoring both route through it. They used to
clamp separately, and only the dragging path kept its clamp, so a position saved on a wide
screen came back on a narrow one entirely off-screen: invisible, unclickable, and
impossible to drag back. A test asserts the clamp exists exactly once. A rule written twice
drifts in the copy; this repository has produced that bug more than once.

**Bottom left by default.** That corner of a repository page holds the least content. Top
left sits on GitHub's own navigation; bottom right runs into content that grows down the
page.

## Browser differences

- **Injected CSS resolves relative URLs differently.** Firefox resolves them against the
  CSS file; Chromium does not. The button's artwork is therefore passed in as a CSS custom
  property built from `runtime.getURL()`, and listed in `web_accessible_resources` for
  `https://github.com/*`. Chromium needs that entry; Firefox does not.
- **Host permissions do not apply to content scripts under MV3.** A content script has the
  page's privileges, not the extension's. Nothing here relies on cross-origin access.
- **Verification status:** Firefox verified on a real profile. Edge verified — installed,
  settings, and the panel on GitHub. Chrome is built for, not verified in the browser.
- **Firefox registers protocol handlers in its own `handlers.json`,** separate from the
  Windows registry. A registry scan is not evidence that a scheme is unhandled.

## Settings

Stored under one key, `ricehubSettings`, as a single normalized object.

| Field | Meaning |
|---|---|
| `destination` | `claude`, `codex`, or `custom` |
| `customTemplate` | HTTPS template containing `{prompt}` once, outside the authority |
| `language` | `en` or `zh-TW`; applies to the settings page and the requested report |
| `sectionIds` | Which analysis sections to ask for; empty falls back to all |
| `sectionPrompts` | Per-section wording that replaces the default question |
| `buttonSize` | 44–160 px |
| `claudeColor` / `codexColor` / `customColor` | The ring colour per destination |
| `buttonPosition` | `{left, top}` or `null` for "wherever the stylesheet puts it" |

The ring colour is not decoration. Which agent a click will open is the one fact the
button cannot otherwise show: the setting lives on another page, and by the time the wrong
agent opens, noticing is too late to help.

Any code that saves settings must **read first and merge**. The content script writes the
dragged position while the options page is open; a form that rebuilds the object from its
own fields alone erases that position on every save.

## Tests

```sh
npm test
```

Node's built-in runner, no framework, no dependencies. `tests/fake-dom.js` is a hand-written
minimal DOM: it exists so DOM logic can be tested without a headless browser, and it is
deliberately strict. When it diverges from a real browser it hides real bugs — a
`querySelectorAll` that only understood `input[…]` once concealed a production selector
failure — so widen the fake rather than working around it.

Rules for tests here:

- Deterministic. No network, no real clock dependence, no launching real applications.
- Assert the invariant, not the implementation value. Tests that pinned
  `calc(size - 8px)`, a font shorthand, and a grid line each became an obstacle to a
  correct fix. Assert what must remain true.
- Real protocol delivery is manual integration evidence and cannot be claimed by a unit
  test.

The suite covers URL validation, unsafe destination rejection, settings normalization,
prompt limits, trusted clicks, DOM ownership, duplicate cleanup, SPA navigation, bilingual
README parity, Chromium compatibility, and store asset formats.

## Conventions

Two-space indent, UTF-8, final newline, single quotes, `camelCase` for functions and
variables, `UPPER_SNAKE_CASE` for constants, `kebab-case` filenames.

Prefer platform APIs and pure functions. No dependencies. No abstraction with one
implementation.

Comments explain why, not what. A comment that restates the line above it is noise; a
comment carrying a measurement, a browser quirk, or a rejected alternative is the reason
the next person does not undo the fix.

Commits: short imperative subject, then prose saying what was wrong and why the change
takes the shape it does. Unrelated changes go in separate commits. Do not commit or push
without being asked.

## Not in this repository

Product research, threat modelling, and the decision record are kept outside it, as is the
local agent instruction file. A clone contains the extension, its tests, its documentation,
and its store assets — nothing else.
