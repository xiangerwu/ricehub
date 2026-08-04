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

  function buildLaunchUrl(settings, prompt) {
    if (typeof prompt !== 'string' || !prompt) throw new Error('prompt is required');
    const encoded = encodeURIComponent(prompt);
    if (settings.destination === DESTINATION.CLAUDE) {
      return `claude://claude.ai/new?q=${encoded}`;
    }
    if (settings.destination === DESTINATION.CODEX) {
      return `codex://threads/new?prompt=${encoded}`;
    }
    if (settings.destination === DESTINATION.CUSTOM) {
      const template = validateCustomTemplate(settings.customTemplate);
      const result = template.replace(PLACEHOLDER, encoded);
      new URL(result);
      return result;
    }
    throw new Error('unknown destination');
  }

  const api = { DESTINATION, PLACEHOLDER, validateCustomTemplate, buildLaunchUrl };
  root.RiceHubDestinations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
