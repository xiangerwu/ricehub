<img src="docs/branding/ricehub-social-preview.png" alt="RiceHub brand preview">

# RiceHub

**English** · [繁體中文](README.zh-TW.md)

RiceHub is a browser extension for understanding GitHub repositories with an AI agent. On a repository page, click the floating RiceHub button to prepare a focused analysis prompt and open it in Claude Desktop, Codex Desktop, or a custom HTTPS destination.

RiceHub fills the prompt but does not send it. Review or edit the request in your agent, then submit it yourself.

## How It Works

1. Open a GitHub repository page.
2. Click the floating RiceHub button.
3. Review the prepared prompt in your selected AI agent and send it when ready.

The prompt contains the repository's canonical URL, page title, preferred language, and selected analysis topics. Repository details are treated as untrusted data, not instructions.

## Main Features

- Choose Claude Desktop, Codex Desktop, or a custom HTTPS URL.
- Request analysis of purpose, architecture, setup, maintenance, risks, alternatives, and fit.
- Replace any default analysis question with your own wording.
- Use the settings page in English or Traditional Chinese.
- Resize, recolor, drag, and reposition the floating button.

## Install

**From a browser store**

| Browser | Store | Status |
| --- | --- | --- |
| Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/hjhgaaebgogmnekbdmlokdinnbdnmbbl) | Published |
| Chrome | Chrome Web Store | Not submitted yet |
| Firefox | Firefox Add-ons (AMO) | Not submitted yet |

**From this repository**

**Firefox**

1. Open `about:debugging` and select **This Firefox**.
2. Choose **Load Temporary Add-on…**.
3. Select `manifest.json`.

Firefox removes temporary add-ons when the browser closes.

**Chrome 95+ or Edge**

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this repository folder.

After installation, open the extension settings and choose a destination. Firefox and Edge have been verified manually; Chrome support is implemented but still needs browser verification.

## Settings

- **Destination:** Select a desktop agent or provide an HTTPS template containing `{prompt}` exactly once.
- **Language:** Controls both the settings page and requested report language.
- **Analysis sections:** Choose report topics and optionally replace their default questions.
- **Floating button:** Set its size and destination colors. Drag it or use arrow keys to save a new position.

Keep custom questions short. RiceHub stops prompts that exceed the launch URL limit instead of opening a truncated request.

## Privacy and Design Constraints

- Runs only on GitHub pages matched by `https://github.com/*`.
- Reads the current repository URL and page title to build the prompt.
- Does not download repository files, submit prompts, or retrieve analysis results.
- Stores settings locally, but not repository URLs, prompts, results, or credentials.
- Accepts custom destinations only over HTTPS; the destination receives data only after a button click.

## Troubleshooting

1. If the button is missing, confirm you are on a repository page, then reload the extension and tab.
2. If no app opens, confirm the selected desktop app is installed and allow the browser's external-app prompt.
3. If one destination fails, try another to identify whether the desktop protocol handler is the problem.
4. If RiceHub reports that questions are too long, shorten custom questions in settings.

## Development

The extension uses Manifest V3, plain JavaScript, and Node's built-in test runner. It has no dependencies or build step.

Read the [architecture guide](ARCHITECTURE.md) before changing the extension's behavior or security boundaries.

```sh
npm test
```

```text
manifest.json   Extension manifest
src/            Extension code, settings page, and icons
tests/          Automated tests and browser fakes
docs/           Branding source files
store-assets/   Store listing copy and artwork
```
