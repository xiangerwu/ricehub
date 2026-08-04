(function (root) {
  'use strict';

  const Task = root.RiceHubTask || require('./task.js');
  const STORAGE_KEY = 'ricehubSettings';
  const DESTINATIONS = new Set(['claude', 'codex', 'custom']);
  const LANGUAGES = new Set(Object.values(Task.LANGUAGE));
  const ALL_SECTION_IDS = Object.freeze(Task.ANALYSIS_SECTIONS.map(({ id }) => id));
  const DEFAULTS = Object.freeze({
    destination: 'claude',
    customTemplate: '',
    language: Task.LANGUAGE.ENGLISH,
    sectionIds: ALL_SECTION_IDS,
    sectionPrompts: Object.freeze({}),
  });

  function normalizeSettings(value) {
    const input = value && typeof value === 'object' ? value : {};
    const destination = DESTINATIONS.has(input.destination) ? input.destination : DEFAULTS.destination;
    const customTemplate = typeof input.customTemplate === 'string'
      ? input.customTemplate.trim().slice(0, 2048)
      : '';
    const language = LANGUAGES.has(input.language) ? input.language : DEFAULTS.language;
    const requested = Array.isArray(input.sectionIds) ? new Set(input.sectionIds) : null;
    const sectionIds = requested
      ? ALL_SECTION_IDS.filter((id) => requested.has(id))
      : [...ALL_SECTION_IDS];
    const suppliedPrompts = input.sectionPrompts && typeof input.sectionPrompts === 'object'
      ? input.sectionPrompts
      : {};
    const sectionPrompts = {};
    for (const id of ALL_SECTION_IDS) {
      const prompt = Task.sanitizeText(suppliedPrompts[id], Task.MAX_SECTION_PROMPT_CHARS)
        .slice(0, Task.MAX_SECTION_PROMPT_CHARS);
      if (prompt) sectionPrompts[id] = prompt;
    }

    return {
      destination,
      customTemplate,
      language,
      sectionIds: sectionIds.length ? sectionIds : [...ALL_SECTION_IDS],
      sectionPrompts,
    };
  }

  async function load(storageArea) {
    const stored = await storageArea.get(STORAGE_KEY);
    return normalizeSettings(stored && stored[STORAGE_KEY]);
  }

  async function save(storageArea, value) {
    const normalized = normalizeSettings(value);
    await storageArea.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  const api = { STORAGE_KEY, ALL_SECTION_IDS, DEFAULTS, normalizeSettings, load, save };
  root.RiceHubSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
