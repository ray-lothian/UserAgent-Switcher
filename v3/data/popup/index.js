/* global Agent */
'use strict';

// localization
document.querySelectorAll('[data-localized-value]').forEach(e => {
  const ref = e.dataset.localizedValue;
  const translated = chrome.i18n.getMessage(ref);
  if (translated) {
    e.value = translated;
  }
});
document.querySelectorAll('[data-localized-title]').forEach(e => {
  const ref = e.dataset.localizedTitle;
  const translated = chrome.i18n.getMessage(ref);
  if (translated) {
    e.title = translated;
  }
});
document.querySelectorAll('[data-localized-placeholder]').forEach(e => {
  const ref = e.dataset.localizedPlaceholder;
  const translated = chrome.i18n.getMessage(ref);
  if (translated) {
    e.placeholder = translated;
  }
});
document.querySelectorAll('[data-localized-content]').forEach(e => {
  const ref = e.dataset.localizedContent;
  const translated = chrome.i18n.getMessage(ref);
  if (translated) {
    e.dataset.content = translated;
  }
});
document.querySelectorAll('[data-localize]').forEach(e => {
  const ref = e.dataset.localize;
  const translated = chrome.i18n.getMessage(ref);
  if (translated) {
    e.textContent = translated;
  }
});

const DCSI = 'firefox-default';

document.body.dataset.android = navigator.userAgent.indexOf('Android') !== -1;

let tab = {};

chrome.tabs.query({
  active: true,
  currentWindow: true
}, tbs => {
  if (tbs.length) {
    tab = tbs[0];
    if ('cookieStoreId' in tab) {
      const apply = document.querySelector('[data-cmd="apply"]');
      apply.value = chrome.i18n.getMessage('applyContainer');
      apply.title = chrome.i18n.getMessage('applyContainerTitle');

      const w = document.querySelector('[data-cmd="tab"]');
      w.value = chrome.i18n.getMessage('applyContainerTab');
      w.title = chrome.i18n.getMessage('applyContainerTabTitle');

      const reset = document.querySelector('[data-cmd="reset"]');
      reset.value = chrome.i18n.getMessage('resetContainer');
      reset.title = chrome.i18n.getMessage('resetContainerTitle');
    }
  }
});

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
  if (document.getElementById('sort').value === 'descending') {
    return list.reverse();
  }
  return list;
}

function get(path) {
  const cf = Promise.resolve({
    match() {
      return Promise.resolve();
    },
    add() {
      return Promise.resolve();
    }
  });
  return (typeof caches !== 'undefined' ? caches : {
    open() {
      return cf;
    }
  }).open('agents').catch(() => cf).then(cache => {
    const link = 'https://cdn.jsdelivr.net/gh/ray-lothian/UserAgent-Switcher@latest/v3/data/popup/' + path;
    // updating agents once per day
    chrome.storage.local.get({
      ['cache.' + path]: 0
    }, prefs => {
      const now = Date.now();
      if (now - prefs['cache.' + path] > 1 * 24 * 60 * 60 * 1000) {
        cache.add(link).then(() => chrome.storage.local.set({
          ['cache.' + path]: now
        }));
      }
    });
    return cache.match(link).then(resp => resp || fetch(path));
  });
}

function update(ua) {
  const browser = document.getElementById('browser').value;
  const os = document.getElementById('os').value;

  const t = document.querySelector('template');
  const parent = document.getElementById('list');
  const tbody = parent.querySelector('tbody');
  tbody.textContent = '';

  parent.dataset.loading = true;
  get('browsers/' + browser.toLowerCase() + '-' + os.toLowerCase().replace(/\//g, '-') + '.json')
    .then(r => r.json()).catch(e => {
      console.error('CACHE_ERROR', e);
      return [];
    }).then(list => {
      if (list) {
        const fragment = document.createDocumentFragment();
        let radio;
        list = sort(list);
        list.forEach((o, n) => {
          const clone = document.importNode(t.content, true);
          const num = clone.querySelector('td:nth-child(1)');
          num.textContent = n + 1;
          const second = clone.querySelector('td:nth-child(3)');
          if (o.browser.name && o.browser.version) {
            second.title = second.textContent = o.browser.name + ' ' + (o.browser.version || ' ');
          }
          else {
            second.title = second.textContent = '-';
          }
          const third = clone.querySelector('td:nth-child(4)');
          if (o.os.name && o.os.version) {
            third.title = third.textContent = o.os.name + ' ' + (o.os.version || ' ');
          }
          else {
            third.title = third.textContent = '-';
          }
          const forth = clone.querySelector('td:nth-child(5)');
          forth.title = forth.textContent = o.ua;
          if (o.ua === ua) {
            radio = clone.querySelector('input[type=radio]');
          }
          fragment.appendChild(clone);
        });
        tbody.appendChild(fragment);
        if (radio) {
          radio.checked = true;
          radio.scrollIntoView({
            block: 'center',
            inline: 'nearest'
          });
        }
        document.getElementById('custom').placeholder = chrome.i18n.getMessage('filterAmong', [list.length]);
        [...document.getElementById('os').querySelectorAll('option')].forEach(option => {
          option.disabled = (map.matching[browser.toLowerCase()] || []).indexOf(option.value.toLowerCase()) === -1;
        });
      }
      else {
        throw Error('OS is not found');
      }
    // FF 55.0 does not support finally
    }).catch(() => {}).then(() => {
      parent.dataset.loading = false;
    });
}

document.getElementById('browser').addEventListener('change', e => chrome.storage.local.set({
  'popup-browser': e.target.value
}));
document.getElementById('os').addEventListener('change', e => chrome.storage.local.set({
  'popup-os': e.target.value
}));
document.getElementById('sort').addEventListener('change', e => chrome.storage.local.set({
  'popup-sort': e.target.value
}));

document.addEventListener('change', ({target}) => {
  if (target.closest('#filter')) {
    chrome.storage.local.get({
      ua: ''
    }, prefs => update(prefs.ua || navigator.userAgent));
  }
  if (target.type === 'radio') {
    document.getElementById('ua').value = target.closest('tr').querySelector('td:nth-child(5)').textContent;
    document.getElementById('ua').dispatchEvent(new Event('input'));
  }
});

document.addEventListener('DOMContentLoaded', () => fetch('./map.json').then(r => r.json()).then(o => {
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
  document.querySelector('#os optgroup:last-of-type').appendChild(f2);

  chrome.storage.local.get({
    'popup-browser': 'Chrome',
    'popup-os': 'Windows',
    'popup-sort': 'descending',
    'ua': ''
  }, prefs => {
    document.getElementById('browser').value = prefs['popup-browser'];
    document.getElementById('os').value = prefs['popup-os'];
    document.getElementById('sort').value = prefs['popup-sort'];

    update(prefs.ua);
    document.getElementById('ua').value = prefs.ua;
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
        msg(chrome.i18n.getMessage('msgDefaultUA'));
      }
      else {
        msg(chrome.i18n.getMessage('msgUASet'));
      }
      if (value !== navigator.userAgent) {
        // prevent a container ua string from overwriting the default one
        if ('cookieStoreId' in tab && tab.cookieStoreId !== DCSI) {
          chrome.runtime.sendMessage({
            method: 'request-update',
            value,
            cookieStoreId: tab.cookieStoreId
          });
          chrome.storage.local.get({
            'container-uas': {}
          }, prefs => {
            prefs['container-uas'][tab.cookieStoreId] = value;
            chrome.storage.local.set(prefs);
          });
        }
        else {
          chrome.storage.local.set({
            ua: value
          });
        }
      }
    }
    else if (cmd === 'tab') {
      const value = document.getElementById('ua').value;
      chrome.storage.session.set({
        [tab.id]: {
          ua: value,
          cookieStoreId: tab.cookieStoreId
        }
      });
    }
    else if (cmd === 'reset') {
      const input = document.querySelector('#list :checked');
      if (input) {
        input.checked = false;
      }
      // prevent a container ua string from overwriting the default one
      if ('cookieStoreId' in tab && tab.cookieStoreId !== DCSI) {
        chrome.runtime.sendMessage({
          method: 'request-update',
          value: '',
          cookieStoreId: tab.cookieStoreId,
          delete: true
        });
        chrome.storage.local.get({
          'container-uas': {}
        }, prefs => {
          delete prefs['container-uas'][tab.cookieStoreId];
          chrome.storage.local.set(prefs);
        });

        msg(chrome.i18n.getMessage('msgDisabledOnContainer'));
      }
      else {
        chrome.storage.local.set({
          ua: ''
        });
        msg(chrome.i18n.getMessage('msgDisabled'));
      }
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
        'test': 'https://webbrowsertools.com/useragent/?method=normal&verbose=false'
      }, prefs => chrome.tabs.create({
        url: prefs.test
      }));
    }

    if (cmd) {
      target.classList.add('active');
      setTimeout(() => target.classList.remove('active'), 500);
    }
  }
});

document.getElementById('ua').addEventListener('input', e => {
  const value = e.target.value;
  document.querySelector('[data-cmd=apply]').disabled = value === '';
  document.querySelector('[data-cmd=tab]').disabled = value === '';

  if (value) {
    const agent = new Agent();

    chrome.storage.local.get({
      'userAgentData': true,
      'parser': {} // maps ua string to a ua object
    }, prefs => {
      agent.prefs(prefs);
      const o = agent.parse(value);

      document.getElementById('appVersion').value = o.appVersion;
      document.getElementById('platform').value = o.platform;
      document.getElementById('vendor').value = o.vendor;
      document.getElementById('product').value = o.product;
      document.getElementById('oscpu').value = o.oscpu;
    });
  }
});
document.getElementById('ua').addEventListener('keyup', e => {
  if (e.key === 'Enter') {
    document.querySelector('[data-cmd="apply"]').click();
  }
});

/* container support */
document.querySelector('[data-cmd="container"]').addEventListener('click', () => {
  chrome.permissions.request({
    permissions: ['cookies']
  }, granted => {
    if (granted) {
      window.close();
    }
  });
});
if (/Firefox/.test(navigator.userAgent) && chrome.permissions) {
  chrome.permissions.contains({
    permissions: ['cookies']
  }, granted => {
    if (granted === false) {
      document.querySelector('[data-cmd="container"]').classList.remove('hide');
    }
  });
}
