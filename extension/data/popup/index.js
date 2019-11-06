'use strict';

document.body.dataset.android = navigator.userAgent.indexOf('Android') !== -1;

const map = {};

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

function update(ua) {
  const browser = document.getElementById('browser').value;
  const os = document.getElementById('os').value;

  const t = document.querySelector('template');
  const parent = document.getElementById('list');
  const tbody = parent.querySelector('tbody');
  tbody.textContent = '';

  parent.dataset.loading = true;
  fetch('browsers/' + browser.toLowerCase() + '-' + os.toLowerCase().replace(/\//g, '-') + '.json').then(r => r.json()).catch(e => {
    console.error(e);
    return [];
  }).then(list => {
    if (list) {
      const fragment = document.createDocumentFragment();
      let radio;
      for (const o of sort(list)) {
        const clone = document.importNode(t.content, true);
        const second = clone.querySelector('td:nth-child(2)');
        second.title = second.textContent = o.browser.name + ' ' + (o.browser.version || ' ');
        const third = clone.querySelector('td:nth-child(3)');
        third.title = third.textContent = o.os.name + ' ' + (o.os.version || ' ');
        const forth = clone.querySelector('td:nth-child(4)');
        forth.title = forth.textContent = o.ua;
        if (o.ua === ua) {
          radio = clone.querySelector('input[type=radio]');
        }
        fragment.appendChild(clone);
      }
      tbody.appendChild(fragment);
      if (radio) {
        radio.checked = true;
        radio.scrollIntoView({
          block: 'center',
          inline: 'nearest'
        });
      }
      document.getElementById('custom').placeholder = `Filter among ${list.length}`;
      [...document.getElementById('os').querySelectorAll('option')].forEach(option => {
        option.disabled = map.matching[browser.toLowerCase()].indexOf(option.value.toLowerCase()) === -1;
      });
    }
    else {
      throw Error('OS is not found');
    }
  }).finally(() => {
    parent.dataset.loading = false;
  });
}

document.addEventListener('change', ({target}) => {
  if (target.closest('#filter')) {
    localStorage.setItem(target.id, target.value);
    chrome.storage.local.get({
      ua: ''
    }, prefs => update(prefs.ua || navigator.userAgent));
  }
  if (target.type === 'radio') {
    document.getElementById('ua').value = target.closest('tr').querySelector('td:nth-child(4)').textContent;
    document.getElementById('ua').dispatchEvent(new Event('input'));
  }
});
document.addEventListener('DOMContentLoaded', () => fetch('./map.json').then(r => r.json())
  .then(o => {
    Object.assign(map, o);

    const f1 = document.createDocumentFragment();
    for (const browser of map.browser) {
      const option = document.createElement('option');
      option.value = option.textContent = browser;
      f1.appendChild(option);
    }
    const f2 = document.createDocumentFragment();
    for (const os of map.os) {
      const option = document.createElement('option');
      option.value = option.textContent = os;
      f2.appendChild(option);
    }

    document.querySelector('#browser optgroup:last-of-type').appendChild(f1);
    document.getElementById('browser').value = localStorage.getItem('browser') || 'Chrome';

    document.querySelector('#os optgroup:last-of-type').appendChild(f2);
    document.getElementById('os').value = localStorage.getItem('os') || 'Windows';

    chrome.storage.local.get({
      ua: ''
    }, prefs => {
      const ua = prefs.ua || navigator.userAgent;
      update(ua);
      document.getElementById('ua').value = ua;
      document.getElementById('ua').dispatchEvent(new Event('input'));
    });
  }));

document.getElementById('list').addEventListener('click', ({target}) => {
  const tr = target.closest('tbody tr');
  if (tr) {
    const input = tr.querySelector('input');
    if (input && input !== target) {
      input.checked = true;
      input.dispatchEvent(new Event('change', {
        bubbles: true
      }));
    }
  }
});

document.getElementById('custom').addEventListener('keyup', ({target}) => {
  const value = target.value;
  [...document.querySelectorAll('#list tbody tr')]
    .forEach(tr => tr.dataset.matched = tr.textContent.toLowerCase().indexOf(value.toLowerCase()) !== -1);
});

chrome.storage.onChanged.addListener(prefs => {
  if (prefs.ua) {
    document.getElementById('ua').value = prefs.ua.newValue || navigator.userAgent;
    document.getElementById('ua').dispatchEvent(new Event('input'));
  }
});

function msg(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  window.setTimeout(() => toast.textContent = '', 2000);
}

// commands
document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;
  if (cmd) {
    if (cmd === 'apply') {
      const value = document.getElementById('ua').value;
      if (value === navigator.userAgent) {
        msg('Default UA, press the reset button instead');
      }
      else {
        msg('User-Agent is Set');
      }
      chrome.storage.local.set({
        ua: value === navigator.userAgent ? '' : value
      });
    }
    else if (cmd === 'window') {
      const value = document.getElementById('ua').value;
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, ([tab]) => chrome.runtime.getBackgroundPage(bg => bg.ua.update(value, tab.windowId)));
    }
    else if (cmd === 'reset') {
      const input = document.querySelector('#list :checked');
      if (input) {
        input.checked = false;
      }
      chrome.storage.local.set({
        ua: ''
      });
      msg('Reset to Default');
    }
    else if (cmd === 'refresh') {
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, ([tab]) => chrome.tabs.reload(tab.id, {
        bypassCache: true
      }));
    }
    else if (cmd === 'options') {
      chrome.runtime.openOptionsPage();
    }
    else if (cmd === 'reload') {
      chrome.runtime.reload();
    }
    else if (cmd === 'test') {
      chrome.storage.local.get({
        'test': 'https://webbrowsertools.com/useragent/?method=normal&verbose=false&r=' + Math.random()
      }, prefs => chrome.tabs.create({
        url: prefs.test
      }));
    }

    if (cmd) {
      target.classList.add('active');
      window.setTimeout(() => target.classList.remove('active'), 500);
    }
  }
});

document.getElementById('ua').addEventListener('input', e => {
  const value = e.target.value;
  document.querySelector('[data-cmd=apply]').disabled = value === '';
  document.querySelector('[data-cmd=window]').disabled = value === '';

  if (value) {
    chrome.runtime.getBackgroundPage(bg => {
      const o = bg.ua.parse(value);
      document.getElementById('appVersion').value = o.appVersion;
      document.getElementById('platform').value = o.platform;
      document.getElementById('vendor').value = o.vendor;
      document.getElementById('product').value = o.product;
      document.getElementById('oscpu').value = o.oscpu;
    });
  }
});
