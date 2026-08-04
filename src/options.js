(function (root) {
  'use strict';

  const Task = root.RiceHubTask || require('./task.js');
  const Destinations = root.RiceHubDestinations || require('./destinations.js');
  const Settings = root.RiceHubSettings || require('./settings.js');
  const VALIDATION_KEYS = Object.freeze({
    'Select at least one analysis section.': 'error.noSections',
    'custom URL template is required': 'error.customRequired',
    'custom URL must contain exactly one {prompt}': 'error.customPlaceholder',
    'custom URL is invalid': 'error.customInvalid',
    'custom URL must be HTTPS without credentials': 'error.customScheme',
    '{prompt} must be in the URL path, query, or fragment': 'error.customPosition',
  });

  function message(doc, key, fallback) {
    const I18n = root.RiceHubOptionsI18n;
    const language = doc.getElementById('language').value;
    return I18n && typeof I18n.message === 'function'
      ? I18n.message(language, key)
      : fallback;
  }

  function renderSections(doc, settings) {
    const host = doc.getElementById('analysis-sections');
    const selected = new Set(settings.sectionIds);
    for (const section of Task.ANALYSIS_SECTIONS) {
      const label = doc.createElement('label');
      const checkbox = doc.createElement('input');
      const text = doc.createElement('span');
      const prompt = doc.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'section';
      checkbox.value = section.id;
      checkbox.checked = selected.has(section.id);
      text.id = `section-label-${section.id}`;
      text.textContent = section.labels[settings.language];
      prompt.type = 'text';
      prompt.name = 'section-prompt';
      prompt.value = settings.sectionPrompts[section.id] || '';
      prompt.placeholder = section.prompts[settings.language];
      prompt.setAttribute('data-section-id', section.id);
      prompt.setAttribute('aria-labelledby', text.id);
      prompt.maxLength = Task.MAX_SECTION_PROMPT_CHARS;
      label.append(checkbox, text, prompt);
      host.append(label);
    }
  }

  function updateSectionLanguage(doc) {
    const language = doc.getElementById('language').value;
    for (const section of Task.ANALYSIS_SECTIONS) {
      doc.getElementById(`section-label-${section.id}`).textContent = section.labels[language];
      doc.querySelector(`input[data-section-id="${section.id}"]`).placeholder = section.prompts[language];
    }
  }

  function readForm(doc) {
    const sectionIds = Array.from(doc.querySelectorAll('input[name="section"]'))
      .filter((input) => input.checked)
      .map((input) => input.value);
    if (!sectionIds.length) throw new Error('Select at least one analysis section.');
    const sectionPrompts = {};
    for (const input of doc.querySelectorAll('input[name="section-prompt"]')) {
      const value = input.value.trim();
      if (value) sectionPrompts[input.getAttribute('data-section-id')] = value;
    }

    const destination = doc.getElementById('destination').value;
    const customTemplate = doc.getElementById('custom-template').value.trim();
    if (destination === Destinations.DESTINATION.CUSTOM) {
      Destinations.validateCustomTemplate(customTemplate);
    }
    return {
      destination,
      customTemplate,
      language: doc.getElementById('language').value,
      sectionIds,
      sectionPrompts,
    };
  }

  function updateCustomField(doc) {
    const isCustom = doc.getElementById('destination').value === Destinations.DESTINATION.CUSTOM;
    doc.getElementById('custom-template').disabled = !isCustom;
  }

  async function init(doc, browserApi) {
    const current = await Settings.load(browserApi.storage.local);
    doc.getElementById('destination').value = current.destination;
    doc.getElementById('custom-template').value = current.customTemplate;
    doc.getElementById('language').value = current.language;
    renderSections(doc, current);
    updateCustomField(doc);

    doc.getElementById('destination').addEventListener('change', () => updateCustomField(doc));
    doc.getElementById('language').addEventListener('change', () => updateSectionLanguage(doc));
    doc.getElementById('settings-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = doc.getElementById('save-status');
      try {
        await Settings.save(browserApi.storage.local, readForm(doc));
        status.textContent = message(doc, 'status.saved', 'Settings saved.');
      } catch (error) {
        const fallback = error instanceof Error ? error.message : 'Could not save settings.';
        status.textContent = message(
          doc,
          VALIDATION_KEYS[fallback] || 'status.failed',
          fallback,
        );
      }
    });
  }

  const api = { renderSections, updateSectionLanguage, readForm, updateCustomField, init };
  root.RiceHubOptions = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    init(root.document, root.browser).catch(() => {});
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
