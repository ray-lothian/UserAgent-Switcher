/* globals UAParser */

'use strict';

const DCSI = 'firefox-default';

const cache = {}; // cache how a tab's request get handled (true, false, object)
const tabs = {};
const cookieStoreIds = {};
chrome.tabs.onRemoved.addListener(id => {
  delete cache[id];
  delete tabs[id];
  delete cookieStoreIds[id];
});
chrome.tabs.onCreated.addListener(tab => {
  tabs[tab.id] = tab.windowId;
  cookieStoreIds[tab.id] = tab.cookieStoreId;
});

const prefs = {
  'ua': '',
  'blacklist': [],
  'whitelist': [],
  'custom': {},
  'siblings': {}, // a list of domains that are considered siblings (use same index for all)
  'mode': 'blacklist',
  'color': '#777',
  'cache': true,
  'exactMatch': false,
  'protected': [
    'google.com/recaptcha',
    'gstatic.com/recaptcha',
    'accounts.google.com',
    'accounts.youtube.com',
    'gitlab.com/users/sign_in'
  ],
  'parser': {}, // maps ua string to a ua object,
  'log': false,
  'json-guid': 'na'
};
window.prefs = prefs; // access from popup

const log = (...args) => prefs.log && console.log(...args);

// expand comma-separated keys of prefs.custom and add missing keys
const expand = () => {
  log('expanding custom rules');
  expand.rules = {};
  for (const key of Object.keys(prefs.custom)) {
    for (const k of key.split(/\s*,\s*/)) {
      if (k) {
        expand.rules[k] = prefs.custom[key];
        // make sure all siblings have the same expanded rule
        const i = prefs.siblings[key];
        if (i !== undefined) {
          for (const [hostname, j] of Object.entries(prefs.siblings)) {
            if (i === j) {
              expand.rules[hostname] = expand.rules[hostname] || prefs.custom[key];
              if (expand.rules._) {
                const x = expand.rules._.indexOf(key);
                const y = expand.rules._.indexOf(hostname);
                if (x !== -1 && y === -1) {
                  expand.rules._.push(hostname);
                }
                if (x === -1 && y !== -1) {
                  expand.rules._.push(key);
                }
              }
            }
          }
        }
      }
    }
  }
};
expand.rules = {};

const currentCookieStoreId = () => new Promise(resolve => chrome.tabs.query({
  active: true,
  currentWindow: true
}, tbs => {
  resolve((tbs.length ? tbs[0].cookieStoreId : '') || DCSI);
}));

chrome.storage.local.get(prefs, ps => {
  Object.assign(prefs, ps);
  expand();

  chrome.tabs.query({}, ts => {
    ts.forEach(t => {
      tabs[t.id] = t.windowId;
      cookieStoreIds[t.id] = t.cookieStoreId;
    });

    // update prefs.ua from the managed storage
    try {
      chrome.storage.managed.get({
        'ua': '',
        'json': ''
      }, rps => {
        if (!chrome.runtime.lastError) {
          const p = {};
          if (rps.json) {
            try {
              const j = JSON.parse(rps.json);
              if (prefs['json-guid'] !== j['json-guid'] || j['json-forced']) {
                Object.assign(p, j);
                console.warn('preferences are updated by an admin');
              }
            }
            catch (e) {
              console.warn('cannot parse remote JSON', e);
            }
          }
          if (rps.ua) {
            p.ua = rps.ua;
            console.warn('user-agent string is updated by an admin');
          }
          chrome.storage.local.set(p, () => {
            ua.update(undefined, undefined, DCSI);
          });
        }
        else {
          ua.update(undefined, undefined, DCSI);
        }
      });
    }
    catch (e) {
      ua.update(undefined, undefined, DCSI);
    }
  });

  if (chrome.browserAction.setBadgeBackgroundColor) { // FF for Android
    chrome.browserAction.setBadgeBackgroundColor({
      color: prefs.color
    });
  }
  // context menu
  chrome.contextMenus.create({
    id: 'blacklist',
    title: 'Switch to "black-list" mode',
    contexts: ['browser_action'],
    type: 'radio',
    checked: prefs.mode === 'blacklist'
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    id: 'whitelist',
    title: 'Switch to "white-list" mode',
    contexts: ['browser_action'],
    type: 'radio',
    checked: prefs.mode === 'whitelist'
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    id: 'custom',
    title: 'Switch to "custom" mode',
    contexts: ['browser_action'],
    type: 'radio',
    checked: prefs.mode === 'custom'
  }, () => chrome.runtime.lastError);
});
chrome.storage.onChanged.addListener(ps => {
  Object.keys(ps).forEach(key => prefs[key] = ps[key].newValue);

  if (ps.ua || ps.mode) {
    currentCookieStoreId().then(cookieStoreId => {
      if (ps.ua) {
        if (ps.ua.newValue === '') {
          delete ua._obj[cookieStoreId];
        }
      }
      ua.update(undefined, undefined, cookieStoreId);
    });
  }
  if (ps.custom) {
    expand();
  }
});

const ua = {
  _obj: {},
  diff(tabId, cookieStoreId = DCSI) { // returns true if there is per window object
    log('ua.diff is called', tabId, cookieStoreId);
    const windowId = tabs[tabId];
    return windowId in (this._obj[cookieStoreId] || this._obj[DCSI] || {});
  },
  get windows() {
    log('ua.windows is called');
    const ids = [];
    for (const cookieStoreId of Object.keys(this._obj)) {
      ids.push(...Object.keys(this._obj[cookieStoreId]).filter(id => id !== 'global').map(s => Number(s)));
    }
    return ids.filter((n, i, l) => n && l.indexOf(n) === i);
  },
  parse: s => {
    log('ua.parse is called', s);
    if (prefs.parser[s]) {
      log('ua.parse is resolved using parser');
      return Object.assign({
        userAgent: s
      }, prefs.parser[s]);
    }
    // build ua string from the navigator object or from a custom UAParser;
    // examples: ${platform}, ${browser.version|ua-parser}
    s = s.replace(/\${([^}]+)}/g, (a, b) => {
      const key = (parent, keys) => {
        for (const key of keys) {
          parent = parent[key] || {};
        }

        return parent;
      };

      let [childs, object] = b.split('|');
      object = object || 'navigator';

      let v;
      if (object.startsWith('ua-parser')) {
        const [a, b] = object.split('@');
        object = a;

        v = key((new UAParser(b || navigator.userAgent)).getResult(), childs.split('.'));
      }
      v = v || key(navigator, childs.split('.'));
      return typeof v === 'string' ? v : 'cannot parse your ${...} replacements.';
    });
    const o = {};
    o.userAgent = s;
    o.appVersion = s
      .replace(/^Mozilla\//, '')
      .replace(/^Opera\//, '');

    const isFF = /Firefox/.test(s);
    const isCH = /Chrome/.test(s);
    const isSF = /Safari/.test(s) && isCH === false;

    if (isFF) {
      o.appVersion = '5.0 ' + o.appVersion.replace('5.0 ', '').split(/[\s;]/)[0] + ')';
    }
    const p = (new UAParser(s)).getResult();
    o.platform = p.os.name || '';
    if (o.platform === 'Mac OS') {
      o.platform = 'MacIntel';
    }
    o.vendor = p.device.vendor || '';
    if (isSF) {
      o.vendor = 'Apple Computer, Inc.';
    }
    else if (isFF === false) {
      o.vendor = 'Google Inc.';
    }
    o.product = p.engine.name || '';
    if (s.indexOf('Gecko') !== -1) {
      o.product = 'Gecko';
    }
    if (isFF) {
      o.oscpu = ((p.os.name || '') + ' ' + (p.os.version || '')).trim();
      o.userAgentData = '[delete]';
      o.productSub = '20100101';
      o.buildID = '20181001000000';
    }
    else {
      o.oscpu = '[delete]';
      o.buildID = '[delete]';
      o.productSub = '20030107';
      if (p.browser && p.browser.major) {
        o.userAgentData = {
          brands: [
            {brand: ' Not A;Brand', version: '99'},
            {brand: 'Chromium', version: p.browser.major},
            {brand: 'Google Chrome', version: p.browser.major}
          ],
          mobile: /Android|webOS|iPhone|iPad|Mac|Macintosh|iPod|BlackBerry|IEMobile|Opera Mini/i.test(s)
        };
      }
    }

    if (o.userAgent === 'empty') {
      Object.keys(o).forEach(key => {
        if (key !== 'userAgent') {
          o[key] = '';
        }
      });
    }
    return o;
  },
  object(tabId, windowId, cookieStoreId = DCSI) {
    windowId = windowId || (tabId ? tabs[tabId] : 'global');
    log('ua.object is called', tabId, windowId, cookieStoreId);

    if (this._obj[cookieStoreId]) {
      return this._obj[cookieStoreId][windowId] || this._obj[cookieStoreId].global;
    }
  },
  string(str, windowId, cookieStoreId) {
    log('ua.string is called', str, windowId);
    this._obj[cookieStoreId] = this._obj[cookieStoreId] || {};
    if (str) {
      this._obj[cookieStoreId][windowId] = this.parse(str);
    }
    else {
      this._obj[cookieStoreId][windowId] = {};
    }
  },
  tooltip(title, tabId) {
    log('ua.tooltip is called', title, tabId);
    chrome.browserAction.setTitle({
      title,
      tabId
    });
  },
  icon(mode, tabId) {
    log('ua.icon is called', mode, tabId);
    chrome.browserAction.setIcon({
      tabId,
      path: {
        '16': 'data/icons/' + (mode ? mode + '/' : '') + '16.png',
        '18': 'data/icons/' + (mode ? mode + '/' : '') + '18.png',
        '19': 'data/icons/' + (mode ? mode + '/' : '') + '19.png',
        '32': 'data/icons/' + (mode ? mode + '/' : '') + '32.png',
        '36': 'data/icons/' + (mode ? mode + '/' : '') + '36.png',
        '38': 'data/icons/' + (mode ? mode + '/' : '') + '38.png',
        '48': 'data/icons/' + (mode ? mode + '/' : '') + '48.png'
      }
    });
  },
  toolbar: ({windowId, tabId, cookieStoreId}) => {
    log('ua.toolbar is called', windowId, tabId);
    if (windowId) {
      chrome.tabs.query({
        windowId
      }, tabs => tabs.forEach(tab => {
        const tabId = tab.id;
        const o = ua.object(null, windowId, tab.cookieStoreId);
        chrome.browserAction.setBadgeText({
          tabId,
          text: o && o.platform ? o.platform.substr(0, 3) : ''
        });
      }));
    }
    else if (tabId) {
      const o = ua.object(tabId, undefined, cookieStoreId);
      chrome.browserAction.setBadgeText({
        tabId,
        text: o.platform ? o.platform.substr(0, 3) : 'BOT'
      });
    }
  },
  update(str = prefs.ua, windowId = 'global', cookieStoreId = DCSI) {
    log('ua.update is called', str, windowId, cookieStoreId);
    // clear caching
    Object.keys(cache).forEach(key => delete cache[key]);
    // remove old listeners
    chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
    chrome.webNavigation.onCommitted.removeListener(onCommitted);
    // apply new ones
    if (str || prefs.mode === 'custom' || this.windows.length || Object.keys(this._obj).length) {
      if (str) {
        ua.string(str, windowId, cookieStoreId);
      }
      chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {
        'urls': ['*://*/*', 'ws://*/*', 'wss://*/*']
      }, ['blocking', 'requestHeaders']);
      chrome.webNavigation.onCommitted.addListener(onCommitted);
      ua.tooltip('[Default] ' + navigator.userAgent);
      ua.icon('ignored');
    }
    else {
      ua.icon('');
      ua.tooltip('[Disabled] to enable, use the popup window');
    }

    if (windowId === 'global') {
      this.toolbar({str});
    }
    // update per window
    else {
      this.windows.forEach(windowId => this.toolbar({windowId}));
    }
  }
};
window.ua = ua; // using from popup
// make sure to clean on window removal
if (chrome.windows) { // FF on Android
  chrome.windows.onRemoved.addListener(windowId => {
    let update = false;
    Object.keys(ua._obj).forEach(cookieStoreId => {
      if (windowId in ua._obj[cookieStoreId]) {
        delete ua._obj[cookieStoreId][windowId];
        // delete the entire object if it is empty
        if (Object.keys(ua._obj[cookieStoreId]).length === 0) {
          delete ua._obj[cookieStoreId];
        }
        update = true;
      }
    });
    // if nothing is left to monitor, disable the extension
    if (update) {
      currentCookieStoreId().then(cookieStoreId => ua.update(undefined, undefined, cookieStoreId));
    }
  });
}

function hostname(url) {
  log('hostname', url);
  const s = url.indexOf('//') + 2;
  if (s > 1) {
    let o = url.indexOf('/', s);
    if (o > 0) {
      return url.substring(s, o);
    }
    else {
      o = url.indexOf('?', s);
      if (o > 0) {
        return url.substring(s, o);
      }
      else {
        return url.substring(s);
      }
    }
  }
  else {
    return url;
  }
}
// returns true, false or an object; true: ignore, false: use from ua object.
function match({url, tabId, cookieStoreId = DCSI}) {
  log('match', url, tabId, cookieStoreId);
  const h = hostname(url);

  if (prefs.protected.some(s => url.indexOf(s) !== -1)) {
    return true;
  }

  if (prefs.mode === 'blacklist') {
    if (prefs.blacklist.length) {
      return prefs.blacklist.some(s => {
        if (s === h) {
          return true;
        }
        else if (prefs.exactMatch === false) {
          return s.endsWith('.' + h) || h.endsWith('.' + s);
        }
      });
    }
  }
  else if (prefs.mode === 'whitelist') {
    if (prefs.whitelist.length) {
      return prefs.whitelist.some(s => {
        if (s === h) {
          return true;
        }
        else if (prefs.exactMatch === false) {
          return s.endsWith('.' + h) || h.endsWith('.' + s);
        }
      }) === false;
    }
    else {
      return true;
    }
  }
  const [hh] = h.split(':');
  const key = Object.keys(expand.rules).filter(s => {
    if (s === h || s === hh) {
      return true;
    }
    else if (prefs.exactMatch === false) {
      return s.endsWith('.' + h) || h.endsWith('.' + s) || s.endsWith('.' + hh) || hh.endsWith('.' + s);
    }
  }).shift();
  let s;
  // try to use an already resolved sibling hostname
  const i = prefs.siblings[key];
  if (i !== undefined) {
    for (const [hostname, j] of Object.entries(prefs.siblings)) {
      if (j === i && expand.rules[hostname] && typeof expand.rules[hostname] === 'string') {
        s = expand.rules[hostname];
      }
    }
  }
  s = s || expand.rules[key];
  // use '*' when the hostname specific key is not found
  s = s || expand.rules['*'];
  // if s is an array select a random string
  if (Array.isArray(s)) {
    s = s[Math.floor(Math.random() * s.length)];
    // set session mode if key is either on _[key] or _['*'] lists
    if (expand.rules._ && Array.isArray(expand.rules._)) {
      if (expand.rules._.indexOf(key) !== -1) {
        expand.rules[key] = s;
      }
      else if (expand.rules._.indexOf('*') !== -1) {
        if (expand.rules[key]) {
          expand.rules[key] = s;
        }
        else if (expand.rules['*']) {
          expand.rules['*'] = s;
        }
      }
    }
  }
  if (s) {
    return ua.parse(s);
  }
  else {
    const o = ua.object(tabId, undefined, cookieStoreId);
    return o ? !o.userAgent : true;
  }
}

const onBeforeSendHeaders = d => {
  const {tabId, url, requestHeaders, type} = d;
  const cookieStoreId = d.cookieStoreId || cookieStoreIds[tabId] || DCSI;

  if (type === 'main_frame' || prefs.cache === false) {
    cookieStoreIds[tabId] = cookieStoreId;
    cache[tabId] = match({url, tabId, cookieStoreId});
  }

  if (cache[tabId] === true) {
    return {};
  }
  if (prefs.protected.some(s => url.indexOf(s) !== -1)) {
    return {};
  }
  const o = (cache[tabId] || ua.object(tabId, undefined, cookieStoreId));

  const str = o ? o.userAgent : '';
  if (str && requestHeaders.length) {
    for (
      let i = 0, name = requestHeaders[0].name;
      i < requestHeaders.length;
      i += 1, name = (requestHeaders[i] || {}).name
    ) {
      if (name === 'User-Agent' || name === 'user-agent') {
        requestHeaders[i].value = str === 'empty' ? '' : str;
        return {
          requestHeaders
        };
      }
    }
  }
};

const onCommitted = d => {
  const {frameId, url, tabId} = d;
  const cookieStoreId = d.cookieStoreId || cookieStoreIds[tabId] || DCSI;

  if (url && (url.startsWith('http') || url.startsWith('ftp')) || url === 'about:blank') {
    if (cache[tabId] === true) {
      return;
    }
    const o = cache[tabId] || ua.object(tabId, undefined, cookieStoreId);
    if (o && o.userAgent) {
      chrome.tabs.executeScript(tabId, {
        runAt: 'document_start',
        frameId,
        code: `{
          const script = document.createElement('script');
          script.textContent = \`{
            document.currentScript.dataset.injected = true;
            const o = JSON.parse('${JSON.stringify(o)}');

            for (const key of Object.keys(o)) {
              if (o[key] === '[delete]') {
                delete Object.getPrototypeOf(window.navigator)[key];
              }
              else {
                navigator.__defineGetter__(key, () => {
                  if (o[key] === 'empty') {
                    return '';
                  }
                  return o[key];
                });
              }
            }
          }\`;
          document.documentElement.appendChild(script);
          if (script.dataset.injected !== 'true') {
            const s = document.createElement('script');
            s.src = 'data:text/javascript;charset=utf-8;base64,' + btoa(script.textContent);
            document.documentElement.appendChild(s);
            s.remove();
          }
          script.remove();
        }`
      }, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError &&
          lastError.message !== 'No matching message handler' && // Firefox on Windows
          lastError.message !== 'document.documentElement is null' // Firefox on Windows
        ) {
          if (frameId === 0) {
            ua.tooltip('[Default] ' + navigator.userAgent, tabId);
            ua.icon('ignored', tabId);
          }
        }
        else if (frameId === 0) {
          ua.tooltip('[Custom] ' + o.userAgent, tabId);
          ua.icon('active', tabId);
        }
      });
    }
  }
  // change the toolbar icon if there is a per window UA setting
  if (frameId === 0 && ua.diff(tabId, cookieStoreId)) {
    ua.toolbar({tabId, cookieStoreId});
  }
};
// context menu
chrome.contextMenus.onClicked.addListener(info => chrome.storage.local.set({
  mode: info.menuItemId
}));

// restore container agents
chrome.storage.local.get({
  'container-uas': {}
}, prefs => {
  for (const cookieStoreId of Object.keys(prefs['container-uas'])) {
    ua.string(prefs['container-uas'][cookieStoreId], 'global', cookieStoreId);
  }
});

/* message passing */
chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'parse-ua') {
    response(ua.parse(request.value));
  }
  else if (request.method === 'get-ua') {
    response(prefs.ua || '' || navigator.userAgent);
  }
  else if (request.method === 'request-update') {
    if (request.delete) {
      delete ua._obj[request.cookieStoreId];
    }
    ua.update(request.value, request.windowId, request.cookieStoreId);
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
