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
  // Punctuation belongs to the language too; an ASCII full stop between Chinese
  // clauses reads as a mistake to anyone actually reading it.
  const SEPARATORS = Object.freeze({ en: '. ', 'zh-TW': '。' });
  // Said at the point of action, not only in the options page. Someone deciding whether
  // to press this should be able to read what leaves the page and where it goes without
  // having opened anything else first.
  const DISCLOSURE = Object.freeze({
    en: (target) => `Sends this repository's address and page title to ${target}`,
    'zh-TW': (target) => `會把這個儲存庫的網址與頁面標題送到${target}`,
  });
  const TARGETS = Object.freeze({
    en: { claude: 'Claude Desktop', codex: 'Codex Desktop', custom: 'your configured address' },
    'zh-TW': { claude: 'Claude 桌面版', codex: 'Codex 桌面版', custom: '你設定的網址' },
  });
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

  /**
   * `onSettled` is called with the panel's final position after a drag or a key press,
   * never during one: saving on every pointermove would write to storage dozens of
   * times per second for a value nobody reads until the page reloads.
   */
  function makeDraggable(parts, win, onSettled) {
    if (!win || !parts.panel || !parts.button) return;
    const { panel, button, interaction } = parts;
    let drag = null;
    const settle = () => {
      if (typeof onSettled !== 'function') return;
      const rect = panel.getBoundingClientRect();
      onSettled({ left: Math.round(rect.left), top: Math.round(rect.top) });
    };

    const position = (left, top) => placePanel(panel, win, left, top);

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
      // 10px, not 4. A press drifts a few pixels on a trackpad, and the click after a
      // drag is swallowed on purpose, so too tight a threshold turns an imprecise press
      // into a press that does nothing. This is a comfort change, not a fix for the
      // empty-composer report in the README; that one is not on this side.
      if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) < 10) return;
      drag.moved = true;
      position(event.clientX - drag.x, event.clientY - drag.y);
      if (event.preventDefault) event.preventDefault();
    });
    const stop = (event) => {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      if (drag.moved) {
        interaction.suppressActivation = true;
        settle();
      }
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
      settle();
      if (event.preventDefault) event.preventDefault();
    });
  }

  /**
   * Puts the panel at a viewport position, never outside it.
   *
   * Dragging and restoring both come through here. They used to have a clamp each, and
   * only the dragging one kept it, so a position saved on a wide screen came back on a
   * narrow one entirely off-screen: invisible, unclickable, and impossible to drag back.
   */
  function placePanel(panel, win, left, top) {
    const width = panel.offsetWidth || 0;
    const height = panel.offsetHeight || 0;
    const maxLeft = Math.max(0, (win && win.innerWidth ? win.innerWidth : width) - width);
    const maxTop = Math.max(0, (win && win.innerHeight ? win.innerHeight : height) - height);
    panel.style.left = `${Math.min(maxLeft, Math.max(0, left))}px`;
    panel.style.top = `${Math.min(maxTop, Math.max(0, top))}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function applyPosition(parts, position, win) {
    if (!parts || !parts.panel || !position) return false;
    const { left, top } = position;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return false;
    placePanel(parts.panel, win, left, top);
    return true;
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
    const destination = parts.button.getAttribute('data-ricehub-destination') || 'claude';
    const targets = TARGETS[language] || TARGETS[DEFAULT_LANGUAGE];
    const disclose = DISCLOSURE[language] || DISCLOSURE[DEFAULT_LANGUAGE];
    const gap = SEPARATORS[language] || SEPARATORS[DEFAULT_LANGUAGE];
    const action = [
      labels[STATE.IDLE],
      disclose(targets[destination] || targets.claude),
      MOVE_LABELS[language] || MOVE_LABELS[DEFAULT_LANGUAGE],
    ].join(gap);
    parts.button.setAttribute('data-ricehub-state', state);
    parts.button.setAttribute('aria-label', action);
    parts.button.setAttribute('title', state === STATE.IDLE ? action : `${text}${gap}${action}`);
    parts.status.textContent = text;
    return state;
  }

  function setLanguage(parts, language, destination) {
    const selected = LABELS[language] ? language : DEFAULT_LANGUAGE;
    parts.button.setAttribute('data-ricehub-language', selected);
    if (destination) parts.button.setAttribute('data-ricehub-destination', destination);
    return setState(parts, parts.button.getAttribute('data-ricehub-state') || STATE.IDLE);
  }

  function mount(doc, parts, repo, win, { position, onSettled } = {}) {
    const existing = findExisting(doc);
    if (existing) return existing.button;
    purge(doc);
    if (!findRepositoryMarker(doc, repo)) return null;
    doc.body.append(parts.panel);
    applyPosition(parts, position, win);
    makeDraggable(parts, win, onSettled);
    return parts.button;
  }

  const api = {
    PANEL_ID,
    BUTTON_ID,
    STATUS_ID,
    STATE,
    LABELS,
    DISCLOSURE,
    TARGETS,
    DEFAULT_LANGUAGE,
    REPOSITORY_MARKER_SELECTORS,
    findRepositoryMarker,
    findExisting,
    isOurs,
    purge,
    createButton,
    applyPosition,
    placePanel,
    makeDraggable,
    setState,
    setLanguage,
    mount,
    unmount: purge,
  };

  root.RiceHubButton = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
