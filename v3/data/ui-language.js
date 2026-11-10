'use strict';

// Optional language selection for extension-owned UI, including PC and mobile.
// 'auto' preserves the browser's existing localization behaviour.
const uiLanguage = (() => {
  let messages = null;

  function getMessage(key, substitutions) {
    const message = messages?.[key]?.message;
    if (typeof message === 'string') {
      const args = Array.isArray(substitutions) ? substitutions : [substitutions];
      return message.replace(/\$([1-9])/g, (match, n) => {
        const value = args[Number(n) - 1];
        return value === undefined ? match : String(value);
      });
    }
    return chrome.i18n.getMessage(key, substitutions);
  }

  function applyTranslations() {
    for (const e of document.querySelectorAll('[data-localize]')) {
      const value = getMessage(e.dataset.localize);
      if (value) e.textContent = value;
    }
    for (const e of document.querySelectorAll('[data-localized-value]')) {
      const value = getMessage(e.dataset.localizedValue);
      if (value) e.value = value;
    }
    for (const e of document.querySelectorAll('[data-localized-title]')) {
      const value = getMessage(e.dataset.localizedTitle);
      if (value) e.title = value;
    }
    for (const e of document.querySelectorAll('[data-localized-placeholder]')) {
      const value = getMessage(e.dataset.localizedPlaceholder);
      if (value) e.placeholder = value;
    }
    for (const e of document.querySelectorAll('[data-localized-content]')) {
      const value = getMessage(e.dataset.localizedContent);
      if (value) e.dataset.content = value;
    }
    for (const e of document.querySelectorAll('[data-localized-label]')) {
      const value = getMessage(e.dataset.localizedLabel);
      if (value) e.label = value;
    }


  }

  async function initialize() {
    const prefs = await new Promise(resolve => {
      chrome.storage.local.get({'ui-language': 'auto'}, resolve);
    });
    const value = prefs['ui-language'];
    const selection = ['auto', 'ko', 'en'].includes(value) ? value : 'auto';
    const picker = document.getElementById('ui-language');
    if (picker) {
      picker.value = selection;
      picker.addEventListener('change', () => {
        chrome.storage.local.set({'ui-language': picker.value}, () => location.reload());
      });
    }

    if (selection !== 'auto') {
      // Only bundled extension resources are loaded, not remote translations.
      const url = chrome.runtime.getURL('_locales/' + selection + '/messages.json');
      const response = await fetch(url);
      if (!response.ok) throw Error('Unable to load locale ' + selection);
      messages = await response.json();
    }
    applyTranslations();
  }

  initialize().catch(error => console.error('UI localization:', error));
  return {getMessage, applyTranslations};
})();
