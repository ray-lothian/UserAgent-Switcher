/* globals UAParser */
'use strict';

var json = [];

function filter(list) {
  return list.filter(o => {
    const browser = document.getElementById('browser').value;
    if (browser && browser !== 'skipped') {
      try {
        if (o.browser.name.toLowerCase().trim().indexOf(browser.trim()) === -1) {
          return false;
        }
      }
      catch (e) {
        return false;
      }
    }
    const os = document.getElementById('os').value;
    if (os && os !== 'skipped') {
      try {
        if (o.os.name.toLowerCase().trim().indexOf(os.trim()) === -1) {
          return false;
        }
      }
      catch (e) {
        return false;
      }
    }
    return true;
  });
}

function sort(arr) {
  function sort(a = '', b = '') {
    const pa = a.split('.');
    const pb = b.split('.');
    for (let i = 0; i < 3; i++) {
      const na = Number(pa[i]);
      const nb = Number(pb[i]);
      if (na > nb) {
        return 1;
      }
      if (nb > na) {
        return -1;
      }
      if (!isNaN(na) && isNaN(nb)) {
        return 1;
      }
      if (isNaN(na) && !isNaN(nb)) {
        return -1;
      }
    }
    return 0;
  }
  const list = arr.sort((a, b) => sort(a.browser.version, b.browser.version));
  if (document.getElementById('sort').value === 'true') {
    return list.reverse();
  }
  return list;
}

function parse(j) {
  json = j.map(s => UAParser(s));
}

function update() {
  const list = sort(filter(json));
  const t = document.querySelector('template');
  const parent = document.getElementById('list');
  const tbody = parent.querySelector('tbody');
  tbody.textContent = '';
  parent.dataset.loading = true;
  window.setTimeout(() => {
    const fragment = document.createDocumentFragment();
    list.forEach(o => {
      const clone = document.importNode(t.content, true);
      const second = clone.querySelector('td:nth-child(2)');
      second.title = second.textContent = o.browser.name + ' ' + (o.browser.version || ' ');
      const third = clone.querySelector('td:nth-child(3)');
      third.title = third.textContent = o.os.name + ' ' + (o.os.version || ' ');
      const forth = clone.querySelector('td:nth-child(4)');
      forth.title = forth.textContent = o.ua;
      fragment.appendChild(clone);
    });
    tbody.appendChild(fragment);
    document.getElementById('custom').placeholder = `Filter among ${list.length} "User-Agent" strings`;
    parent.dataset.loading = false;
  }, 1000);
}

document.addEventListener('change', ({target}) => {
  if (target.closest('#filter')) {
    localStorage.setItem(target.id, target.value);
    update();
  }
  if (target.closest('#list')) {
    document.getElementById('ua').value = target.closest('tr').querySelector('td:nth-child(4)').textContent;
  }
});

document.getElementById('list').addEventListener('click', ({target}) => {
  const tr = target.closest('tr');
  if (tr) {
    const input = tr.querySelector('input');
    if (input && input !== target) {
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', {
        bubbles: true
      }));
    }
  }
});

document.getElementById('custom').addEventListener('keyup', ({target}) => {
  const value = target.value;
  [...document.querySelectorAll('#list tr')]
    .forEach(tr => tr.dataset.matched = tr.textContent.toLowerCase().indexOf(value.toLowerCase()) !== -1);
});

// init
document.getElementById('os').value = localStorage.getItem('os') || 'windows';
document.getElementById('browser').value = localStorage.getItem('browser') || 'chrome';
chrome.storage.local.get({
  ua: ''
}, prefs => document.getElementById('ua').value = prefs.ua || navigator.userAgent);
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.ua) {
    document.getElementById('ua').value = prefs.ua.newValue || navigator.userAgent;
  }
});
window.addEventListener('load', () => {
  window.setTimeout(() => {
    const req = new XMLHttpRequest();
    req.onload = () => {
      parse(req.response);
      update();
    };
    req.open('GET', 'list.json');
    req.responseType = 'json';
    req.send();
  }, 100);
});

// commands
document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;
  if (cmd) {
    if (cmd === 'apply') {
      chrome.storage.local.set({
        ua: document.getElementById('ua').value
      });
    }
    else if (cmd === 'reset') {
      const input = document.querySelector('#list :checked');
      if (input) {
        input.checked = false;
      }
      chrome.storage.local.set({
        ua: ''
      });
    }
    else if (cmd === 'refresh') {
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, ([tab]) => chrome.tabs.reload(tab.id, {
        bypassCache: true
      }));
    }
  }
});
