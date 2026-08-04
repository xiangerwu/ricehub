(function (root) {
  'use strict';

  const Task = root.RiceHubTask || require('./task.js');
  const STORAGE_KEY = 'ricehubSettings';
  const DESTINATIONS = new Set(['claude', 'codex', 'custom']);
  const LANGUAGES = new Set(Object.values(Task.LANGUAGE));
  const ALL_SECTION_IDS = Object.freeze(Task.ANALYSIS_SECTIONS.map(({ id }) => id));
  const BUTTON_SIZE = Object.freeze({ MIN: 44, MAX: 160, DEFAULT: 88 });
  const HEX_COLOR = /^#[0-9a-f]{6}$/i;
  const DEFAULTS = Object.freeze({
    destination: 'claude',
    customTemplate: '',
    language: Task.LANGUAGE.ENGLISH,
    sectionIds: ALL_SECTION_IDS,
    sectionPrompts: Object.freeze({}),
    buttonSize: BUTTON_SIZE.DEFAULT,
    claudeColor: '#d97757',
    codexColor: '#10a37f',
    customColor: '#8250df',
    buttonPosition: null,
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
    const requestedSize = Number(input.buttonSize);
    const buttonSize = Number.isFinite(requestedSize)
      ? Math.min(BUTTON_SIZE.MAX, Math.max(BUTTON_SIZE.MIN, Math.round(requestedSize)))
      : DEFAULTS.buttonSize;
    // One colour per destination. Which agent a click will open is the one thing the
    // button cannot otherwise show: the setting lives on another page, and by the time
    // the wrong agent opens it is too late to notice.
    const colorOr = (value, fallback) => (typeof value === 'string' && HEX_COLOR.test(value)
      ? value.toLowerCase()
      : fallback);
    // null means "wherever the stylesheet puts it", which is how a fresh install starts.
    const suppliedPosition = input.buttonPosition;
    const buttonPosition = suppliedPosition
      && Number.isFinite(Number(suppliedPosition.left))
      && Number.isFinite(Number(suppliedPosition.top))
      ? {
        left: Math.max(0, Math.round(Number(suppliedPosition.left))),
        top: Math.max(0, Math.round(Number(suppliedPosition.top))),
      }
      : null;
    const claudeColor = colorOr(input.claudeColor, DEFAULTS.claudeColor);
    const codexColor = colorOr(input.codexColor, DEFAULTS.codexColor);
    const customColor = colorOr(input.customColor, DEFAULTS.customColor);

    return {
      destination,
      customTemplate,
      language,
      sectionIds: sectionIds.length ? sectionIds : [...ALL_SECTION_IDS],
      sectionPrompts,
      buttonSize,
      claudeColor,
      codexColor,
      customColor,
      buttonPosition,
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

  /**
   * The colour standing for whichever destination a click would open right now.
   *
   * The button cannot otherwise show this: the choice lives on another page, and by the
   * time the wrong agent opens, noticing is too late to help.
   */
  function destinationColor(settings) {
    if (settings.destination === 'codex') return settings.codexColor;
    if (settings.destination === 'custom') return settings.customColor;
    return settings.claudeColor;
  }

  const api = {
    STORAGE_KEY,
    ALL_SECTION_IDS,
    BUTTON_SIZE,
    DEFAULTS,
    normalizeSettings,
    destinationColor,
    load,
    save,
  };
  root.RiceHubSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
