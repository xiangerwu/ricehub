(function (root) {
  'use strict';

  const DESTINATION = Object.freeze({ CLAUDE: 'claude', CODEX: 'codex', CUSTOM: 'custom' });
  const PLACEHOLDER = '{prompt}';

  function validateCustomTemplate(template) {
    if (typeof template !== 'string' || template.length > 2048) {
      throw new Error('custom URL template is required');
    }
    const first = template.indexOf(PLACEHOLDER);
    if (first === -1 || first !== template.lastIndexOf(PLACEHOLDER)) {
      throw new Error('custom URL must contain exactly one {prompt}');
    }

    let parsed;
    try {
      parsed = new URL(template.replace(PLACEHOLDER, 'ricehub-prompt'));
    } catch {
      throw new Error('custom URL is invalid');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new Error('custom URL must be HTTPS without credentials');
    }

    const schemeLength = 'https://'.length;
    const delimiterAt = template.slice(schemeLength).search(/[/?#]/);
    const authorityEnd = delimiterAt === -1 ? -1 : schemeLength + delimiterAt;
    if (authorityEnd === -1 || first < authorityEnd) {
      throw new Error('{prompt} must be in the URL path, query, or fragment');
    }
    return template;
  }

  // Measured on 2026-08-04: opening the same desktop deep link twice leaves the composer
  // empty the second time, while the same link with a few trailing spaces fills it. The
  // agent treats an identical link as a repeat of the one it already handled, so each
  // launch is made textually distinct. Trailing whitespace is the smallest difference
  // that achieves it and the only one a reader will never see.
  //
  // The count varies with the clock rather than cycling through a short fixed list, so
  // two launches a few seconds apart do not land on the same padding.
  const NONCE_RANGE = 17;

  function launchPadding(now) {
    const at = Number.isFinite(now) ? now : Date.now();
    return ' '.repeat(1 + (Math.abs(Math.trunc(at)) % NONCE_RANGE));
  }

  function buildLaunchUrl(settings, prompt, now) {
    if (typeof prompt !== 'string' || !prompt) throw new Error('prompt is required');
    const encoded = encodeURIComponent(prompt);
    // Only the desktop schemes need it. A custom HTTPS endpoint belongs to whoever
    // configured it, and padding their query string is not our decision to make.
    const distinct = encodeURIComponent(prompt + launchPadding(now));
    if (settings.destination === DESTINATION.CLAUDE) {
      return `claude://claude.ai/new?q=${distinct}`;
    }
    if (settings.destination === DESTINATION.CODEX) {
      return `codex://threads/new?prompt=${distinct}`;
    }
    if (settings.destination === DESTINATION.CUSTOM) {
      const template = validateCustomTemplate(settings.customTemplate);
      const result = template.replace(PLACEHOLDER, encoded);
      new URL(result);
      return result;
    }
    throw new Error('unknown destination');
  }

  const api = { DESTINATION, PLACEHOLDER, NONCE_RANGE, launchPadding, validateCustomTemplate, buildLaunchUrl };
  root.RiceHubDestinations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
