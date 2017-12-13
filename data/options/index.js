'use strict';

function notify(msg) {
  // Update status to let user know options were saved.
  const status = document.getElementById('status');
  status.textContent = msg;
  clearTimeout(notify.id);
  notify.id = setTimeout(() => status.textContent = '', 750);
}

function prepare(str) {
  return str.split(/\s*,\s*/)
  .map(s => s.replace('http://', '')
      .replace('https://', '').split('/')[0].trim())
  .filter((h, i, l) => h && l.indexOf(h) === i);
}

function save() {
  let custom = {};
  try {
    custom = JSON.parse(document.getElementById('custom').value);
  }
  catch (e) {
    notify(e.message);
  }

  chrome.storage.local.set({
    faqs: document.getElementById('faqs').checked,
    blacklist: prepare(document.getElementById('blacklist').value),
    whitelist: prepare(document.getElementById('whitelist').value),
    custom,
    mode: document.querySelector('[name="mode"]:checked').value
  }, () => {
    restore();
    notify('Options saved.');
  });
}

function restore() {
  chrome.storage.local.get({
    faqs: true,
    mode: 'blacklist',
    whitelist: [],
    blacklist: [],
    custom: {}
  }, prefs => {
    document.getElementById('faqs').checked = prefs.faqs;
    document.querySelector(`[name="mode"][value="${prefs.mode}"`).checked = true;
    document.getElementById('blacklist').value = prefs.blacklist.join(', ');
    document.getElementById('whitelist').value = prefs.whitelist.join(', ');
    document.getElementById('custom').value = JSON.stringify(prefs.custom, null, 2);
  });
}
document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);

document.getElementById('sample').addEventListener('click', () => {
  document.getElementById('custom').value = JSON.stringify({
    'www.google.com': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36',
    'www.bing.com': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:57.0) Gecko/20100101 Firefox/57.0'
  }, null, 2);
});

document.getElementById('donate').addEventListener('click', () => {
  chrome.tabs.create({
    url: 'https://www.paypal.me/addondonation/10usd'
  });
});
