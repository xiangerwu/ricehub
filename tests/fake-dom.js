// A minimal DOM, implementing only what src/button.js and src/mount.js actually use.
//
// This exists instead of a dependency. Its size is also a check on the production code:
// if this file has to grow much to keep the tests running, the extension has started
// reaching further into the page than it should.

class FakeElement {
  constructor(tagName, doc) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parent = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = '';
    this.className = '';
    this.disabled = false;
    this.id = '';
    this.style = {};
    this.offsetWidth = 190;
    this.offsetHeight = 70;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  getBoundingClientRect() {
    return {
      left: Number.parseFloat(this.style.left) || 0,
      top: Number.parseFloat(this.style.top) || 0,
      width: this.offsetWidth,
      height: this.offsetHeight,
    };
  }

  setPointerCapture() {}

  dispatch(type, event = {}) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }

  /** Depth-first walk, used by the document's selector matching. */
  *walk() {
    for (const child of this.children) {
      yield child;
      yield* child.walk();
    }
  }
}

class FakeDocument {
  constructor(selectorTargets = ['main']) {
    this.body = new FakeElement('body', this);
    // Elements the page offers as mount points, keyed by the selector that finds them.
    this.selectorTargets = new Map();
    for (const selector of selectorTargets) {
      const host = new FakeElement('div', this);
      host.parent = this.body;
      this.body.children.push(host);
      this.selectorTargets.set(selector, host);
    }
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  /**
   * Walks the tree rather than keeping an index. A real document only finds elements it
   * actually contains, and an index that also knows about detached elements would have
   * hidden a duplicate-button bug instead of exposing it.
   */
  getElementById(id) {
    if (!id) return null;
    for (const node of this.body.walk()) {
      if (node.id === id) return node;
    }
    return null;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    if (all.length) return all[0];
    return this.selectorTargets.get(selector) || null;
  }

  /** Supports `#id` and `tag[attr="value"]`, which is all the production code asks for. */
  querySelectorAll(selector) {
    // The tag name is optional, exactly as in a real document. Requiring it here once
    // hid a production selector that had stopped matching its own element.
    const attrMatch = /^([a-z]*)\[([a-z-]+)="([^"]+)"\]$/.exec(selector);
    if (attrMatch) {
      const [, tagName, attribute, value] = attrMatch;
      return Array.from(this.body.walk()).filter((node) => {
        if (tagName && node.tagName !== tagName.toUpperCase()) return false;
        const actual = attribute === 'name' ? node.name : node.getAttribute(attribute);
        return actual === value;
      });
    }
    if (typeof selector !== 'string' || !selector.startsWith('#')) {
      const target = this.selectorTargets.get(selector);
      return target ? [target] : [];
    }
    const id = selector.slice(1);
    const found = [];
    for (const node of this.body.walk()) {
      if (node.id === id) found.push(node);
    }
    return found;
  }

  /** Simulates GitHub replacing the page content in place. */
  replaceContent() {
    for (const host of this.selectorTargets.values()) {
      for (const child of [...host.children]) child.remove();
    }
  }
}

class FakeWindow {
  constructor(href) {
    this.location = { href };
    this.listeners = new Map();
    this.innerWidth = 1280;
    this.innerHeight = 720;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter((entry) => entry !== handler));
  }

  /** Navigates the way a single-page application does: address changes, no reload. */
  navigate(href) {
    this.location.href = href;
    for (const handler of this.listeners.get('popstate') || []) handler({});
  }
}

/** A MutationObserver stand-in whose callback fires only when the test says so. */
class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observing = false;
    FakeObserver.instances.push(this);
  }

  observe() {
    this.observing = true;
  }

  disconnect() {
    this.observing = false;
  }

  static fireAll() {
    for (const instance of FakeObserver.instances) {
      if (instance.observing) instance.callback([]);
    }
  }

  static reset() {
    FakeObserver.instances = [];
  }
}

FakeObserver.instances = [];

module.exports = { FakeElement, FakeDocument, FakeWindow, FakeObserver };
