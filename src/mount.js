(function (root) {
  'use strict';

  const Task = root.RiceHubTask || require('./task.js');
  const Button = root.RiceHubButton || require('./button.js');

  function sync(doc, location, onActivate, win, language) {
    const repo = Task.parseRepo(location.href);
    if (!repo) {
      Button.unmount(doc);
      return null;
    }

    const existing = Button.findExisting(doc);
    if (existing && existing.button.getAttribute('data-ricehub-repo') === repo.canonicalUrl) {
      return existing.button;
    }
    Button.purge(doc);

    const parts = Button.createButton(doc, () => onActivate(repo, parts), language);
    parts.button.setAttribute('data-ricehub-repo', repo.canonicalUrl);
    return Button.mount(doc, parts, repo, win);
  }

  function observe(win, doc, onActivate, { ObserverImpl, getLanguage } = {}) {
    const Observer = ObserverImpl || win.MutationObserver;
    let lastHref = null;
    const run = () => sync(
      doc,
      win.location,
      onActivate,
      win,
      getLanguage ? getLanguage() : Button.DEFAULT_LANGUAGE,
    );
    const runIfMoved = () => {
      if (win.location.href === lastHref) return;
      lastHref = win.location.href;
      run();
    };

    runIfMoved();
    win.addEventListener('popstate', runIfMoved);

    let observer = null;
    if (Observer && doc.body) {
      observer = new Observer(() => {
        if (win.location.href !== lastHref) {
          lastHref = win.location.href;
          run();
        } else if (Task.parseRepo(win.location.href) && !Button.findExisting(doc)) {
          run();
        }
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }

    return function stop() {
      win.removeEventListener('popstate', runIfMoved);
      if (observer) observer.disconnect();
    };
  }

  const api = { sync, observe };
  root.RiceHubMount = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
