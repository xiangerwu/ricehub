(function (root) {
  'use strict';

  const Task = root.RiceHubTask || require('./task.js');
  const Destinations = root.RiceHubDestinations || require('./destinations.js');
  const Settings = root.RiceHubSettings || require('./settings.js');
  const Button = root.RiceHubButton || require('./button.js');
  const Mount = root.RiceHubMount || require('./mount.js');
  const BUTTON_IMAGE_PATH = 'src/icons/fab/ricehub-fab-256.png';
  const DETAILS = Object.freeze({
    en: Object.freeze({ popupBlocked: 'popup blocked', checkSettings: 'check extension settings' }),
    'zh-TW': Object.freeze({ popupBlocked: '彈出視窗遭封鎖', checkSettings: '請檢查擴充功能設定' }),
  });

  function requestOpen(win, settings, launchUrl) {
    if (settings.destination === Destinations.DESTINATION.CLAUDE) {
      const top = win.top || win;
      top.location.href = launchUrl;
      return true;
    }

    // A `noopener` window intentionally returns null even when it opens. Opening a blank
    // same-origin page first lets us detect a blocked HTTPS popup and sever its opener
    // before it navigates to the user-configured destination.
    const popup = win.open('', '_blank');
    if (!popup) return false;
    popup.opener = null;
    popup.location.replace(launchUrl);
    return true;
  }

  function createActivation(win, doc, getSettings) {
    return (repo, parts) => {
      let detail = DETAILS.en;
      try {
        const settings = getSettings();
        detail = DETAILS[settings.language] || DETAILS.en;
        const prompt = Task.buildPrompt(repo, doc.title, settings);
        const launchUrl = Destinations.buildLaunchUrl(settings, prompt);
        if (settings.destination === Destinations.DESTINATION.CODEX) {
          parts.button.href = launchUrl;
          parts.button.target = '_self';
          Button.setState(parts, Button.STATE.REQUESTED);
          return true;
        }
        const requested = requestOpen(win, settings, launchUrl);
        Button.setState(
          parts,
          requested ? Button.STATE.REQUESTED : Button.STATE.FAILED,
          requested ? undefined : detail.popupBlocked,
        );
        return false;
      } catch {
        Button.setState(parts, Button.STATE.FAILED, detail.checkSettings);
        return false;
      }
    };
  }

  function applyAppearance(doc, settings, imageUrl) {
    const style = doc && doc.documentElement && doc.documentElement.style;
    if (!style || typeof style.setProperty !== 'function') return;
    style.setProperty('--ricehub-button-size', `${settings.buttonSize}px`);
    style.setProperty('--ricehub-button-background', Settings.destinationColor(settings));
    style.setProperty('--ricehub-button-image', `url("${imageUrl}")`);
  }

  async function start(win, doc, browserApi, { ObserverImpl } = {}) {
    const imageUrl = browserApi.runtime.getURL(BUTTON_IMAGE_PATH);
    let current;
    try {
      current = await Settings.load(browserApi.storage.local);
    } catch {
      current = Settings.normalizeSettings();
    }
    applyAppearance(doc, current, imageUrl);

    const onStorageChanged = (changes, areaName) => {
      if (areaName !== 'local' || !changes[Settings.STORAGE_KEY]) return;
      current = Settings.normalizeSettings(changes[Settings.STORAGE_KEY].newValue);
      applyAppearance(doc, current, imageUrl);
      const parts = Button.findExisting(doc);
      if (parts) Button.setLanguage(parts, current.language);
    };
    browserApi.storage.onChanged.addListener(onStorageChanged);

    const stopMount = Mount.observe(
      win,
      doc,
      createActivation(win, doc, () => current),
      {
        ObserverImpl,
        getLanguage: () => current.language,
        getPlacement: () => ({
          position: current.buttonPosition,
          // Written only once a drag or key press settles, and merged into the settings
          // already in hand so saving a position cannot discard anything else.
          onSettled: (buttonPosition) => {
            current = { ...current, buttonPosition };
            Settings.save(browserApi.storage.local, current).catch(() => {});
          },
        }),
      },
    );
    return () => {
      stopMount();
      browserApi.storage.onChanged.removeListener(onStorageChanged);
    };
  }

  const api = { requestOpen, createActivation, applyAppearance, start };
  root.RiceHubContent = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    start(root, root.document, root.browser || root.chrome).catch(() => {});
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
