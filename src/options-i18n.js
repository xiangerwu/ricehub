(function (root) {
  'use strict';

  // Interface strings for the settings page. The page's own chrome follows the same
  // language selector as the analysis, because two separate language switches would be
  // one more decision than this page is worth.
  //
  // Section names and their placeholders are not here: options.js owns those, and they
  // come from the analysis section definitions.
  const STRINGS = {
    en: {
      'page.title': 'RiceHub settings',
      'page.intro': 'Choose where a repository analysis opens, and what the agent is asked to cover.',
      'destination.heading': 'Destination',
      'destination.hint': 'Where the prepared prompt opens. The prompt is filled in for you; you still send it yourself.',
      'destination.label': 'Agent',
      'destination.custom': 'Custom HTTPS URL',
      'custom.label': 'Custom URL template',
      'custom.hint': 'Used only when the agent above is Custom. Must be HTTPS and contain {prompt} exactly once.',
      'language.heading': 'Language',
      'language.hint': 'Applies to both this page and the analysis you ask for.',
      'language.label': 'Language / 語言',
      'appearance.heading': 'Floating button',
      'appearance.hint': 'Adjust the button shown on GitHub repository pages.',
      'appearance.size': 'Size',
      'sections.lengthWarning': 'Keep custom questions short. The link that carries them has a length the agent will cut off, and non-Latin text costs about nine times more of that length per character, so a few long Chinese questions reach the limit far sooner than English ones.',
      'appearance.claudeColor': 'Claude Desktop',
      'appearance.codexColor': 'Codex Desktop',
      'appearance.customColor': 'Custom HTTPS',
      'appearance.colorHint': 'The ring around the button shows which agent a click will open, so you can tell before you press it.',
      'sections.heading': 'Analysis sections / 分析項目',
      'sections.hint': 'Tick what the report should cover. Leave a box empty to use the default question, or type your own to ask it your way.',
      'actions.save': 'Save settings',

      // Shown after the page loads, so they are looked up rather than swapped in place.
      'status.saved': 'Settings saved.',
      'status.failed': 'Could not save settings.',
      'error.noSections': 'Select at least one analysis section.',
      'error.customRequired': 'A custom URL template is required.',
      'error.customPlaceholder': 'The custom URL must contain {prompt} exactly once.',
      'error.customInvalid': 'The custom URL is not a valid address.',
      'error.customScheme': 'The custom URL must be HTTPS and must not contain a username or password.',
      'error.customPosition': '{prompt} must be in the URL path, query, or fragment, not the host.',
    },
    'zh-TW': {
      'page.title': 'RiceHub 設定',
      'page.intro': '選擇分析要在哪裡打開，以及要請代理分析哪些面向。',
      'destination.heading': '目的地',
      'destination.hint': '準備好的提示詞會在這裡打開。提示詞會幫你填好，但送出仍然由你自己按。',
      'destination.label': '代理',
      'destination.custom': '自訂 HTTPS 網址',
      'custom.label': '自訂網址樣板',
      'custom.hint': '只有在上面選「自訂」時才會用到。必須是 HTTPS，而且要剛好包含一個 {prompt}。',
      'language.heading': '語言',
      'language.hint': '同時套用到這個頁面和你要求的分析。',
      'language.label': '語言 / Language',
      'appearance.heading': '懸浮按鈕',
      'appearance.hint': '調整顯示在 GitHub 儲存庫頁面上的按鈕。',
      'appearance.size': '大小',
      'sections.lengthWarning': '自訂問法盡量寫短。帶著它們的那條連結有長度上限，超過的部分代理會直接砍掉，而中文每個字佔掉的長度大約是英文的九倍——所以幾段長一點的中文問法，會比英文早很多撞到上限。',
      'appearance.claudeColor': 'Claude 桌面版',
      'appearance.codexColor': 'Codex 桌面版',
      'appearance.customColor': '自訂 HTTPS',
      'appearance.colorHint': '按鈕外圈的顏色代表按下去會開哪一個代理，不用點進設定就看得出來。',
      'sections.heading': '分析項目 / Analysis sections',
      'sections.hint': '勾選報告要涵蓋的項目。輸入框留空就用預設問法，想換個問法就自己填。',
      'actions.save': '儲存設定',

      'status.saved': '設定已儲存。',
      'status.failed': '無法儲存設定。',
      'error.noSections': '請至少勾選一個分析項目。',
      'error.customRequired': '請填寫自訂網址樣板。',
      'error.customPlaceholder': '自訂網址必須剛好包含一個 {prompt}。',
      'error.customInvalid': '自訂網址不是有效的網址。',
      'error.customScheme': '自訂網址必須是 HTTPS，而且不能包含帳號或密碼。',
      'error.customPosition': '{prompt} 必須放在網址的路徑、查詢字串或片段裡，不能放在主機名稱。',
    },
  };

  const pick = (language) => STRINGS[language] || STRINGS.en;

  /**
   * Looks up a message for code that produces text after the page has been rendered,
   * which `applyLanguage` cannot reach because there is no element to rewrite yet.
   * Falls back to the key's English text, and then to the key itself, so a missing
   * translation degrades to something readable rather than to an empty status line.
   */
  function message(language, key) {
    const strings = pick(language);
    return strings[key] || STRINGS.en[key] || key;
  }

  /**
   * Applies interface strings. Every target carries a `data-i18n` key, so adding a string
   * means adding it to the markup and the table, never editing this function.
   */
  function applyLanguage(doc, language) {
    const strings = pick(language);
    for (const element of doc.querySelectorAll('[data-i18n]')) {
      const value = strings[element.getAttribute('data-i18n')];
      if (typeof value === 'string') element.textContent = value;
    }
    doc.documentElement.lang = language === 'zh-TW' ? 'zh-Hant-TW' : 'en';
    const title = strings['page.title'];
    if (title) doc.title = title;
    return language;
  }

  /**
   * Reads the stored language directly rather than waiting for options.js to finish its
   * own load. Both scripts read the same storage key, so neither has to know about the
   * other's timing.
   */
  async function start(doc, browserApi, SettingsModule) {
    const select = doc.getElementById('language');
    const Settings = SettingsModule || root.RiceHubSettings;

    let language = 'en';
    try {
      const settings = await Settings.load(browserApi.storage.local);
      language = settings.language;
    } catch {
      language = select ? select.value : 'en';
    }

    applyLanguage(doc, language);
    if (select) {
      select.addEventListener('change', () => applyLanguage(doc, select.value));
    }
    return language;
  }

  const api = { STRINGS, applyLanguage, message, start };
  root.RiceHubOptionsI18n = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    start(root.document, root.browser || root.chrome).catch(() => {});
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
