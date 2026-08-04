(function (root) {
  'use strict';

  const PANEL_ID = 'ricehub-panel';
  const BUTTON_ID = 'ricehub-analyze-button';
  const STATUS_ID = 'ricehub-analyze-status';
  const LEGACY_HANDLE_ID = 'ricehub-drag-handle';
  const STATE = Object.freeze({
    IDLE: 'idle',
    REQUESTED: 'requested',
    FAILED: 'failed',
  });
  const DEFAULT_LANGUAGE = 'en';
  const LABELS = Object.freeze({
    en: Object.freeze({
      [STATE.IDLE]: 'Analyze with AI agent',
      [STATE.REQUESTED]: 'Open request sent',
      [STATE.FAILED]: 'Could not open agent',
    }),
    'zh-TW': Object.freeze({
      [STATE.IDLE]: '使用 AI 代理分析',
      [STATE.REQUESTED]: '已送出開啟請求',
      [STATE.FAILED]: '無法開啟代理',
    }),
  });
  const MOVE_LABELS = Object.freeze({ en: 'Drag to move', 'zh-TW': '拖曳以移動' });
  const REPOSITORY_MARKER_SELECTORS = Object.freeze([
    '#repository-details-container ul',
    '#repository-container-header',
    '.pagehead-actions',
  ]);
  const OWNED = new WeakSet();

  const isOurs = (element) => Boolean(element) && OWNED.has(element);
  const occupants = (doc, id) => Array.from(doc.querySelectorAll(`#${id}`));

  function isVisible(element) {
    return !element.closest || !element.closest('[hidden]');
  }

  function findRepositoryMarker(doc, repo) {
    if (repo) {
      const crumb = doc.querySelector(
        `[data-component="Breadcrumbs.Item"][href="/${repo.owner}/${repo.repo}"]`,
      );
      const breadcrumbs = crumb && crumb.closest
        ? crumb.closest('[data-component="Breadcrumbs"]')
        : null;
      if (breadcrumbs && isVisible(breadcrumbs)) return breadcrumbs;
    }

    for (const selector of REPOSITORY_MARKER_SELECTORS) {
      const found = doc.querySelector(selector);
      if (found && isVisible(found)) return found;
    }
    return null;
  }

  function createButton(doc, onActivate, language = DEFAULT_LANGUAGE) {
    let lastActivationAt = Number.NEGATIVE_INFINITY;
    const interaction = { suppressActivation: false };
    const panel = doc.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'ricehub-panel';
    panel.setAttribute('aria-label', 'RiceHub');

    const button = doc.createElement('a');
    button.id = BUTTON_ID;
    button.className = 'ricehub-analyze-button';
    button.href = '#';
    button.setAttribute('data-ricehub-state', STATE.IDLE);
    button.setAttribute('data-ricehub-language', LABELS[language] ? language : DEFAULT_LANGUAGE);

    const status = doc.createElement('span');
    status.id = STATUS_ID;
    status.className = 'ricehub-visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    button.setAttribute('aria-describedby', STATUS_ID);

    button.addEventListener('click', (event) => {
      if (interaction.suppressActivation) {
        interaction.suppressActivation = false;
        if (event && event.preventDefault) event.preventDefault();
        return;
      }
      if (!event || event.isTrusted !== true) {
        if (event && event.preventDefault) event.preventDefault();
        return;
      }
      const now = Date.now();
      if (now >= lastActivationAt && now - lastActivationAt < 1000) {
        if (event.preventDefault) event.preventDefault();
        return;
      }
      lastActivationAt = now;
      const allowDefaultNavigation = onActivate() === true;
      if (!allowDefaultNavigation && event.preventDefault) event.preventDefault();
      if (allowDefaultNavigation && root.setTimeout) {
        // Native anchor activation follows this href during the trusted click.
        // Clear it in the next task so the generated prompt does not remain in GitHub's DOM.
        root.setTimeout(() => { button.href = '#'; }, 0);
      }
    });

    panel.append(button, status);
    for (const node of [panel, button, status]) OWNED.add(node);
    const parts = { panel, button, status, interaction };
    setLanguage(parts, language);
    return parts;
  }

  function makeDraggable(parts, win) {
    if (!win || !parts.panel || !parts.button) return;
    const { panel, button, interaction } = parts;
    let drag = null;

    const position = (left, top) => {
      const width = panel.offsetWidth || 0;
      const height = panel.offsetHeight || 0;
      const maxLeft = Math.max(0, (win.innerWidth || width) - width);
      const maxTop = Math.max(0, (win.innerHeight || height) - height);
      panel.style.left = `${Math.min(maxLeft, Math.max(0, left))}px`;
      panel.style.top = `${Math.min(maxTop, Math.max(0, top))}px`;
      panel.style.right = 'auto';
    };

    button.addEventListener('dragstart', (event) => {
      if (event && event.preventDefault) event.preventDefault();
    });
    button.addEventListener('pointerdown', (event) => {
      if (!event || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
      interaction.suppressActivation = false;
      const rect = panel.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      position(rect.left, rect.top);
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) < 4) return;
      drag.moved = true;
      position(event.clientX - drag.x, event.clientY - drag.y);
      if (event.preventDefault) event.preventDefault();
    });
    const stop = (event) => {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      if (drag.moved) interaction.suppressActivation = true;
      drag = null;
    };
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', () => { drag = null; });
    button.addEventListener('keydown', (event) => {
      const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
      if (!delta) {
        interaction.suppressActivation = false;
        return;
      }
      const rect = panel.getBoundingClientRect();
      position(rect.left + delta[0], rect.top + delta[1]);
      if (event.preventDefault) event.preventDefault();
    });
  }

  function findExisting(doc) {
    const panels = occupants(doc, PANEL_ID);
    const buttons = occupants(doc, BUTTON_ID);
    const statuses = occupants(doc, STATUS_ID);
    const nodes = [panels, buttons, statuses];
    if (nodes.some((items) => items.length !== 1)) return null;
    if (![panels[0], buttons[0], statuses[0]].every(isOurs)) return null;
    if (buttons[0].tagName !== 'A') return null;
    return { panel: panels[0], button: buttons[0], status: statuses[0] };
  }

  function purge(doc) {
    for (const id of [PANEL_ID, LEGACY_HANDLE_ID, BUTTON_ID, STATUS_ID]) {
      for (const node of occupants(doc, id)) node.remove();
    }
  }

  function setState(parts, state, detail) {
    const language = parts.button.getAttribute('data-ricehub-language') || DEFAULT_LANGUAGE;
    const labels = LABELS[language] || LABELS[DEFAULT_LANGUAGE];
    const label = labels[state] || labels[STATE.IDLE];
    const text = detail ? `${label}: ${detail}` : label;
    const action = `${labels[STATE.IDLE]}. ${MOVE_LABELS[language] || MOVE_LABELS[DEFAULT_LANGUAGE]}`;
    parts.button.setAttribute('data-ricehub-state', state);
    parts.button.setAttribute('aria-label', action);
    parts.button.setAttribute('title', state === STATE.IDLE ? action : `${text}. ${action}`);
    parts.status.textContent = text;
    return state;
  }

  function setLanguage(parts, language) {
    const selected = LABELS[language] ? language : DEFAULT_LANGUAGE;
    parts.button.setAttribute('data-ricehub-language', selected);
    return setState(parts, parts.button.getAttribute('data-ricehub-state') || STATE.IDLE);
  }

  function mount(doc, parts, repo, win) {
    const existing = findExisting(doc);
    if (existing) return existing.button;
    purge(doc);
    if (!findRepositoryMarker(doc, repo)) return null;
    doc.body.append(parts.panel);
    makeDraggable(parts, win);
    return parts.button;
  }

  const api = {
    PANEL_ID,
    BUTTON_ID,
    STATUS_ID,
    STATE,
    LABELS,
    DEFAULT_LANGUAGE,
    REPOSITORY_MARKER_SELECTORS,
    findRepositoryMarker,
    findExisting,
    isOurs,
    purge,
    createButton,
    makeDraggable,
    setState,
    setLanguage,
    mount,
    unmount: purge,
  };

  root.RiceHubButton = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
