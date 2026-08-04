<img src="docs/branding/ricehub-social-preview.png" alt="RiceHub brand preview">

# RiceHub

**English** · [繁體中文](README.zh-TW.md)

RiceHub turns the GitHub repository you are looking at into a structured analysis prompt, then hands that prompt to the AI agent you have chosen.

The work is in the prompt. RiceHub recognises repository pages, normalises the URL to its canonical form, refuses paths that are not repositories, treats the repository name and page title as untrusted text rather than instructions, and assembles the questions you selected into one request. Opening the agent is the last step, not the point.

Press the panel on a repository page and the agent opens with the prompt already written. You read it, change it if you want, and press Enter yourself. The report stays in that conversation.

RiceHub does not fetch repository content, classify repository visibility, submit prompts, retrieve results, or store repository data.

## Browser Support

| Browser | Status |
|---|---|
| Firefox | Verified on a real profile |
| Chrome 95+ | Built for, not yet verified in the browser |
| Edge | Built for, not yet verified in the browser |

Chrome and Edge are listed as built for rather than supported because nobody has loaded RiceHub in either browser and worked through it. Until that happens, treat them as experimental.

## Install

RiceHub is not published yet, so it is loaded unpacked.

**Firefox**

1. Open `about:debugging`.
2. Choose **This Firefox**.
3. Choose **Load Temporary Add-on…**.
4. Select `manifest.json` in this repository.

A temporary add-on is removed when Firefox closes, so repeat these steps after a restart.

**Chrome or Edge**

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this repository's folder.

Then open the extension's options page and choose a destination.

## Settings

**Destination.** Claude Desktop, Codex Desktop, or a custom HTTPS address. A custom address is a template containing `{prompt}` exactly once, outside the host.

**Language.** Applies both to the settings page and to the language the analysis is requested in.

**Floating button.** Size, and one colour per destination. The ring around the button is the colour of the destination a click would open, so which agent you are about to use is visible without opening this page. Drag the button anywhere on the page and it stays there; arrow keys nudge it. It starts in the bottom right.

**Analysis sections.** Tick what the report should cover. Each section has a two-line field: leave it empty to ask the default question, or write your own wording to replace it.

## Commands

```sh
npm test
```

Runs the complete deterministic test suite with Node's built-in runner. The project has no dependencies or build step.

## Layout

```text
manifest.json   extension manifest
src/            extension scripts, options page, and icons
tests/          Node tests and minimal browser fakes
docs/           branding artwork, not shipped with the extension
store-assets/   listing copy and store artwork
aidd_docs/      product architecture, decisions, roadmap, and research
```

## Troubleshooting

If pressing the button does nothing:

1. Confirm the selected desktop app is installed. In the address bar, test `claude://claude.ai/new?q=RiceHub%20test` or `codex://threads/new?prompt=RiceHub%20test`. If the matching app does not open, its protocol handler is unavailable; fix that registration before troubleshooting RiceHub.
2. Allow the browser to open the external application if it asks for confirmation.
3. Select another built-in destination in RiceHub. If one app opens and the other does not, the failing app's protocol handler is the likely boundary.
4. After changing local extension files, reload the unpacked extension and the GitHub repository tab.

For Codex, [`src/button.js`](src/button.js) exposes the generated link only during a trusted click, then clears its `href` in the next task. This keeps custom prompt instructions from remaining in GitHub's DOM without delaying native link activation.

## Design Constraints

- Manifest V3, Windows-first validation, no build step.
- Static content script on `https://github.com/*`; no `<all_urls>`.
- `storage` holds configuration only, never credentials, repository URLs, prompts, or results.
- Built-in desktop schemes are fixed; custom destinations are HTTPS only.
- Repository metadata and content are untrusted prompt data.
- “Open request sent” is the strongest success claim: protocol delivery cannot be observed.

Product research, threat modelling, and the decision record are kept outside this repository.
