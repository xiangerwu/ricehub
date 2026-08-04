<img src="docs/branding/ricehub-logo.png" alt="" width="88" align="right">

# RiceHub

**English** · [繁體中文](README.zh-TW.md)

RiceHub is a Firefox extension that opens a GitHub repository analysis prompt in Claude Desktop, Codex Desktop, or a configured HTTPS destination.

Choose a destination, output language, report sections, and optional per-section instructions in the extension options. On a GitHub repository page, use the draggable RiceHub panel and click **Analyze with AI agent**. RiceHub normalizes the repository URL, builds the prompt, and requests that Firefox open the selected app with the prompt prefilled. Review it and press Enter; the report remains in that conversation.

RiceHub does not fetch repository content, classify repository visibility, submit prompts, retrieve results, or store repository data.

## Install

RiceHub is not published, so it is loaded as a temporary add-on:

1. Open `about:debugging` in Firefox.
2. Choose **This Firefox**.
3. Choose **Load Temporary Add-on…**.
4. Select `manifest.json` in this repository.
5. Open the extension's options page and choose a destination.

A temporary add-on is removed when Firefox closes, so repeat these steps after a restart.

## Commands

```sh
npm test
```

Runs the complete deterministic test suite with Node's built-in runner. The project has no dependencies or build step.

## Layout

```text
manifest.json   Firefox manifest
src/            extension scripts, options page, and icons
tests/          Node tests and minimal browser fakes
docs/           branding artwork, not shipped with the extension
aidd_docs/      product architecture, decisions, roadmap, and research
```

## Troubleshooting

If clicking the panel does nothing:

1. Confirm the selected desktop app is installed. In Firefox's address bar, test `claude://claude.ai/new?q=RiceHub%20test` or `codex://threads/new?prompt=RiceHub%20test`. If the matching app does not open, its protocol handler is unavailable; fix that registration before troubleshooting RiceHub.
2. Allow Firefox to open the external application if it asks for confirmation.
3. Select another built-in destination in RiceHub. If one app opens and the other does not, the failing app's protocol handler is the likely boundary.
4. After changing local extension files, reload the temporary add-on and the GitHub repository tab.

For Codex, [`src/button.js`](src/button.js) exposes the generated link only during a trusted click, then clears its `href` in the next task. This keeps custom prompt instructions from remaining in GitHub's DOM without delaying native link activation.

## Design Constraints

- Manifest V3, Windows-first validation, no build step.
- Static content script on `https://github.com/*`; no `<all_urls>`.
- `storage` holds configuration only, never credentials, repository URLs, prompts, or results.
- Built-in desktop schemes are fixed; custom destinations are HTTPS only.
- Repository metadata and content are untrusted prompt data.
- “Open request sent” is the strongest success claim: protocol delivery cannot be observed.

Product research, threat modelling, and the decision record are kept outside this repository.
