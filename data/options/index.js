'use strict';
function prepare(str) {
  return str.split(/\s*,\s*/)
  .map(s => s.replace('http://', '')
      .replace('https://', '').split('/')[0].trim())
  .filter((h, i, l) => h && l.indexOf(h) === i);
}

function save() {
  chrome.storage.local.set({
    faqs: document.getElementById('faqs').checked,
    blacklist: prepare(document.getElementById('blacklist').value),
    whitelist: prepare(document.getElementById('whitelist').value),
    mode: document.getElementById('mode-blacklist').checked ? 'blacklist' : 'whitelist'
  }, () => {
    restore();
    // Update status to let user know options were saved.
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => status.textContent = '', 750);
  });
}

function restore() {
  chrome.storage.local.get({
    faqs: true,
    mode: 'blacklist',
    whitelist: [],
    blacklist: []
  }, prefs => {
    document.getElementById('faqs').checked = prefs.faqs;
    document.getElementById('mode-blacklist').checked = prefs.mode === 'blacklist';
    document.getElementById('mode-whitelist').checked = prefs.mode === 'whitelist';
    document.getElementById('blacklist').value = prefs.blacklist.join(', ');
    document.getElementById('whitelist').value = prefs.whitelist.join(', ');
  });
}
document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);
