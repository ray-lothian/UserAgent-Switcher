/* global Agent */
'use strict';

chrome.storage.local.get({
  'user-styling': ''
}, prefs => {
  document.getElementById('user-styling').textContent = prefs['user-styling'];
});

// localization
document.querySelectorAll('[data-localized-value]').forEach(e => {
  const ref = e.dataset.localizedValue;
  const translated = uiLanguage.getMessage(ref);
  if (translated) {
    e.value = translated;
  }
});
document.querySelectorAll('[data-localized-title]').forEach(e => {
  const ref = e.dataset.localizedTitle;
  const translated = uiLanguage.getMessage(ref);
  if (translated) {
    e.title = translated;
  }
});
document.querySelectorAll('[data-localized-placeholder]').forEach(e => {
  const ref = e.dataset.localizedPlaceholder;
  const translated = uiLanguage.getMessage(ref);
  if (translated) {
    e.placeholder = translated;
  }
});
document.querySelectorAll('[data-localized-content]').forEach(e => {
  const ref = e.dataset.localizedContent;
  const translated = uiLanguage.getMessage(ref);
  if (translated) {
    e.dataset.content = translated;
  }
});
document.querySelectorAll('[data-localize]').forEach(e => {
  const ref = e.dataset.localize;
  const translated = uiLanguage.getMessage(ref);
  if (translated) {
    e.textContent = translated;
  }
});

// Mobile view for phone form factors (narrow-screen check is done by CSS media queries)
document.body.dataset.android = /Android|iPhone|iPod/i.test(navigator.userAgent);

const map = {};

// legacy profiles (see legacy.js) are hidden by default; 'show legacy'
// reveals them for the selected browser/OS view only
let hideLegacy = true;
let expandedKey = '';
// archived profiles waiting for the 'show legacy' control of the current view
let legacyHidden = null;

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

const REFRESH_INTERVAL = 24 * 60 * 60 * 1000;
const REFRESH_TIMEOUT = 8000;
const CDN = 'https://cdn.jsdelivr.net/gh/ray-lothian/UserAgent-Switcher@latest/v3/data/popup/';

// a usable list is an array of UA objects with the fields the UI renders
const validList = json => Array.isArray(json) && json.every(o => o &&
  typeof o.ua === 'string' && o.browser && o.os);

async function get(path) {
  const link = CDN + path;
  const cache = typeof caches === 'undefined' ? null :
    await caches.open('agents').catch(() => null);
  const prefs = await chrome.storage.local.get({
    ['cache.' + path]: 0
  });
  const cached = cache ? await cache.match(link).catch(() => null) : null;

  // updating agents once per day; 'reload' bypasses jsDelivr's max-age so an
  // old tag cannot be served from the HTTP cache; also refresh right away
  // when the Cache Storage entry was evicted while the timestamp survived
  if (!cached || Date.now() - prefs['cache.' + path] > REFRESH_INTERVAL) {
    try {
      const response = await fetch(link, {
        cache: 'reload',
        signal: AbortSignal.timeout(REFRESH_TIMEOUT)
      });
      if (!response.ok) {
        throw Error('HTTP ' + response.status);
      }
      const version = response.headers.get('x-jsd-version') || '';
      const json = await response.clone().json();
      if (!validList(json)) {
        throw Error('invalid payload');
      }
      if (cache) {
        await cache.put(link, response).catch(() => {});
      }
      await chrome.storage.local.set({
        ['cache.' + path]: Date.now(),
        ['cache.version.' + path]: version
      });
      return json;
    }
    catch (e) {
      // keep the stale entry, otherwise fall back to the bundled list
      console.warn('AGENT_UPDATE_FAILED', path, e);
    }
  }

  if (cached) {
    try {
      const json = await cached.json();
      if (validList(json)) {
        return json;
      }
    }
    catch (e) {}
    if (cache) {
      await cache.delete(link).catch(() => {});
    }
  }

  // bundled copy
  try {
    const json = await (await fetch(path)).json();
    return validList(json) ? json : [];
  }
  catch (e) {
    return [];
  }
}

let updateId = 0;

// Mobile view renders fewer agents than desktop (see update())
const MOBILE_AGENT_LIMIT = 50;
// short lists are never split: everything is shown without the legacy control
const LEGACY_AUTO_LIMIT = 10;

// builds one list row; returns the imported template content and the radio
// when the row matches the applied user-agent string
function buildRow(template, o, index, ua) {
  const clone = document.importNode(template.content, true);
  const num = clone.querySelector('td:nth-child(1)');
  num.textContent = index + 1;
  const second = clone.querySelector('td:nth-child(3)');
  const wrapper = document.createElement('span');
  wrapper.className = 'agent-cell';
  const name = document.createElement('span');
  name.className = 'agent-name';
  if (o.browser.name && o.browser.version) {
    second.title = name.textContent = o.browser.name + ' ' + (o.browser.version || ' ');
  }
  else {
    second.title = name.textContent = '-';
  }
  wrapper.appendChild(name);
  if (Legacy.isLegacy(o)) {
    const badge = document.createElement('span');
    badge.className = 'legacy-badge';
    badge.textContent = uiLanguage.getMessage('legacy') || 'Legacy';
    wrapper.appendChild(badge);
  }
  second.appendChild(wrapper);
  const third = clone.querySelector('td:nth-child(4)');
  if (o.os.name && o.os.version) {
    third.title = third.textContent = o.os.name + ' ' + (o.os.version || ' ');
  }
  else {
    third.title = third.textContent = '-';
  }
  const forth = clone.querySelector('td:nth-child(5)');
  forth.title = forth.textContent = o.ua;
  let radio = null;
  if (o.ua === ua) {
    radio = clone.querySelector('input[type=radio]');
  }
  return {clone, radio};
}

function update(ua) {
  const id = ++updateId;
  const browser = document.getElementById('browser').value;
  const os = document.getElementById('os').value;

  const t = document.querySelector('template');
  const parent = document.getElementById('list');
  const tbody = parent.querySelector('tbody');
  tbody.textContent = '';

  parent.dataset.loading = true;
  get('browsers/' + browser.toLowerCase() + '-' + os.toLowerCase().replace(/\//g, '-') + '.json')
    .catch(e => {
      console.error('CACHE_ERROR', e);
      return [];
    }).then(list => {
      // A slower previous selection must not append rows to the current list.
      if (id !== updateId) {
        return;
      }
      if (list) {
        // legacy profiles are hidden unless the user revealed them for this
        // browser/OS view; short lists show everything and an applied
        // legacy agent reveals itself
        const key = browser + '|' + os;
        const hidden = hideLegacy ? list.filter(o => Legacy.isLegacy(o)) : [];
        const current = hidden.length ? list.filter(o => !Legacy.isLegacy(o)) : list;
        if (hidden.length && (current.length < LEGACY_AUTO_LIMIT ||
            (ua && hidden.some(o => o.ua === ua)))) {
          expandedKey = key;
        }
        const expanded = expandedKey === key;
        let rows = expanded || hidden.length === 0 ? list : current;
        const hiddenCount = list.length - rows.length;

        const fragment = document.createDocumentFragment();
        let radio;
        rows = sort(rows);
        const fullLength = rows.length;
        // Mobile view renders fewer rows to keep the popup fast to build, filter and scroll
        if (!expanded && document.body.dataset.android === 'true' && rows.length > MOBILE_AGENT_LIMIT) {
          rows = rows.slice(0, MOBILE_AGENT_LIMIT);
        }
        // the archived profiles the 'show legacy' control can reveal
        legacyHidden = hiddenCount ? {
          key,
          rows: hidden,
          start: rows.length
        } : null;
        rows.forEach((o, n) => {
          const row = buildRow(t, o, n, ua);
          if (row.radio) {
            radio = row.radio;
          }
          fragment.appendChild(row.clone);
        });
        if (hiddenCount) {
          const tr = document.createElement('tr');
          tr.setAttribute('data-legacy-more', '');
          const td = document.createElement('td');
          td.colSpan = 5;
          const input = document.createElement('input');
          input.type = 'button';
          input.dataset.cmd = 'show-legacy';
          input.value = uiLanguage.getMessage('showMoreLegacy', [hiddenCount]) ||
            'Show ' + hiddenCount + ' legacy profiles';
          td.appendChild(input);
          tr.appendChild(td);
          fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
        filter();
        if (radio) {
          radio.checked = true;
          radio.scrollIntoView({
            block: 'center',
            inline: 'nearest'
          });
        }
        document.getElementById('custom').placeholder = uiLanguage.getMessage('filterAmong', [fullLength]);
        [...document.getElementById('os').querySelectorAll('option')].forEach(option => {
          option.disabled = (map.matching[browser.toLowerCase()] || []).indexOf(option.value.toLowerCase()) === -1;
        });
      }
      else {
        throw Error('OS is not found');
      }
    // FF 55.0 does not support finally
    }).catch(() => {}).then(() => {
      if (id === updateId) {
        parent.dataset.loading = false;
      }
    });
}

// appends the archived profiles of the current view without re-rendering the
// list: existing rows are not moved and the scroll position is preserved
function revealLegacy() {
  const pending = legacyHidden;
  if (!pending || pending.rows.length === 0) {
    return;
  }
  const container = document.getElementById('list');
  const scrollTop = container.scrollTop;
  const tbody = container.querySelector('tbody');
  const buttonRow = tbody.querySelector('tr[data-legacy-more]');
  const template = document.querySelector('template');
  const rows = sort(pending.rows.slice());
  const fragment = document.createDocumentFragment();
  const ua = document.getElementById('ua').value;
  rows.forEach((o, n) => {
    const row = buildRow(template, o, pending.start + n, ua);
    if (row.radio) {
      row.radio.checked = true;
    }
    fragment.appendChild(row.clone);
  });
  if (buttonRow) {
    tbody.insertBefore(fragment, buttonRow);
    buttonRow.remove();
  }
  else {
    tbody.appendChild(fragment);
  }
  container.scrollTop = scrollTop;
  legacyHidden = null;
  expandedKey = pending.key;
  filter();
  document.getElementById('custom').placeholder =
    uiLanguage.getMessage('filterAmong', [pending.start + rows.length]);
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

// startup
fetch('./map.json').then(async r => {
  const o = await r.json();
  Object.assign(map, o);

  const prefs = await chrome.storage.local.get({
    'popup-browser': 'Chrome',
    'popup-os': 'Windows',
    'popup-sort': 'descending',
    'ua': '',
    'hide-legacy': true,
    'popular-oss': ['Windows', 'Mac OS', 'Linux', 'Chromium OS', 'Android'],
    'popular-browsers': ['Internet Explorer', 'Safari', 'Chrome', 'Firefox', 'Opera', 'Edge', 'Vivaldi']
  });
  hideLegacy = prefs['hide-legacy'] !== false;

  // legacy rules; a failure keeps every profile visible (fail open)
  await Legacy.load();

  const f1 = document.createDocumentFragment();
  const f3 = document.createDocumentFragment();
  for (const browser of map.browser) {
    const option = document.createElement('option');
    option.value = option.textContent = browser;
    if (prefs['popular-browsers'].includes(browser)) {
      f3.appendChild(option);
    }
    else {
      f1.appendChild(option);
    }
  }
  const f2 = document.createDocumentFragment();
  const f4 = document.createDocumentFragment();
  for (const os of map.os) {
    const option = document.createElement('option');
    option.value = option.textContent = os;
    if (prefs['popular-oss'].includes(os)) {
      f4.appendChild(option);
    }
    else {
      f2.appendChild(option);
    }
  }

  document.querySelector('#browser optgroup:first-of-type').appendChild(f3);
  document.querySelector('#browser optgroup:last-of-type').appendChild(f1);
  document.querySelector('#os optgroup:first-of-type').appendChild(f4);
  document.querySelector('#os optgroup:last-of-type').appendChild(f2);

  document.getElementById('browser').value = prefs['popup-browser'];
  document.getElementById('os').value = prefs['popup-os'];
  document.getElementById('sort').value = prefs['popup-sort'];

  update(prefs.ua);
  document.getElementById('ua').value = prefs.ua;
  document.getElementById('ua').dispatchEvent(new Event('input'));
});

document.getElementById('list').addEventListener('click', ({target}) => {
  const tr = target.closest('tbody tr');
  if (tr) {
    const input = tr.querySelector('input');
    if (tr.hasAttribute('data-legacy-more')) {
      // forward row clicks to the embedded 'show legacy' button
      if (input && input !== target) {
        input.click();
      }
      return;
    }
    if (input && input !== target) {
      input.checked = true;
      input.dispatchEvent(new Event('change', {
        bubbles: true
      }));
    }
  }
});

function filter() {
  const value = document.getElementById('custom').value.toLowerCase();
  let matched = 0;
  // the 'show legacy' control stays visible regardless of the filter
  [...document.querySelectorAll('#list tbody tr:not([data-legacy-more])')]
    .forEach(tr => {
      const m = tr.textContent.toLowerCase().indexOf(value) !== -1;
      tr.dataset.matched = m;
      if (m) {
        matched += 1;
      }
    });
  // hide all rows -> show the no-match message
  document.getElementById('list').dataset.filtered = value && matched === 0;
}
document.getElementById('custom').addEventListener('input', filter);

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
        msg(uiLanguage.getMessage('msgDefaultUA'));
      }
      else {
        msg(uiLanguage.getMessage('msgUASet'));
      }
      if (value !== navigator.userAgent) {
        chrome.storage.local.set({
          ua: value
        });
      }
    }
    else if (cmd === 'reset') {
      const input = document.querySelector('#list :checked');
      if (input) {
        input.checked = false;
      }
      chrome.storage.local.set({
        ua: ''
      });
      msg(uiLanguage.getMessage('msgDisabled'));
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
    else if (cmd === 'tab') {
      chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      }).then(([tab]) => {
        const value = document.getElementById('ua').value;
        chrome.storage.session.set({
          [tab.id]: {
            ua: value
          }
        });
      });
    }
    else if (cmd === 'show-legacy') {
      // reveal the archived profiles in place; no reload, no scroll change
      revealLegacy();
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

document.getElementById('ua').addEventListener('input', async e => {
  const value = e.target.value;
  document.querySelector('[data-cmd=apply]').disabled = value === '';
  document.querySelector('[data-cmd=tab]').disabled = value === '';

  if (value) {
    const agent = new Agent();
    await agent.prefs({
      'userAgentData': true,
      'parser': {} // maps ua string to a ua object
    });
    const o = agent.parse(value);

    document.getElementById('platform').value = o.platform;
    document.getElementById('vendor').value = o.vendor;
    document.getElementById('product').value = o.product;
    document.getElementById('oscpu').value = o.oscpu;
  }
});
document.getElementById('ua').addEventListener('keyup', e => {
  if (e.key === 'Enter') {
    document.querySelector('[data-cmd="apply"]').click();
  }
});
