/* globals UAParser */

'use strict';


const cache = {};
const tabs = {};
chrome.tabs.onRemoved.addListener(id => delete cache[id]);
chrome.tabs.onCreated.addListener(tab => tabs[tab.id] = tab.windowId);

const prefs = {
  ua: '',
  blacklist: [],
  whitelist: [],
  custom: {},
  mode: 'blacklist',
  color: '#777',
  cache: true,
  exactMatch: false,
  protected: ['google.com/recaptcha', 'gstatic.com/recaptcha'],
  parser: {}, // maps ua string to a ua object,
  log: false
};

const log = (...args) => prefs.log && console.log(...args);

// exand comma-separated keys of prefs.custom
const expand = () => {
  log('expanding custom rules');
  expand.rules = {};
  for (const key of Object.keys(prefs.custom)) {
    for (const k of key.split(/\s*,\s*/)) {
      if (k) {
        expand.rules[k] = prefs.custom[key];
      }
    }
  }
};
expand.rules = {};

chrome.storage.local.get(prefs, ps => {
  Object.assign(prefs, ps);
  expand();
  chrome.tabs.query({}, ts => {
    ts.forEach(t => tabs[t.id] = t.windowId);
    ua.update();
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
    ua.update();
  }
  if (ps.custom) {
    expand();
  }
});

const ua = {
  _obj: {
    'global': {}
  },
  diff(tabId) { // returns true if there is per window object
    log('ua.diff is called', tabId);
    const windowId = tabs[tabId];
    return windowId in this._obj;
  },
  get windows() {
    log('ua.windows is called');
    return Object.keys(this._obj).filter(id => id !== 'global').map(s => Number(s));
  },
  parse: s => {
    log('ua.parse is called', s);
    if (prefs.parser[s]) {
      log('ua.parse is resolved using parser');
      return Object.assign({
        userAgent: s
      }, prefs.parser[s]);
    }
    // build ua string from browser defaults;
    s = s.replace(/\${([^}]+)}/g, (a, b) => navigator[b]);
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
    }
    else {
      o.oscpu = '[delete]';
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
  object(tabId, windowId) {
    log('ua.object is called', tabId, windowId);
    windowId = windowId || (tabId ? tabs[tabId] : 'global');
    return this._obj[windowId] || this._obj.global;
  },
  string(str, windowId) {
    log('ua.string is called', str, windowId);
    if (str) {
      this._obj[windowId] = this.parse(str);
    }
    else {
      this._obj[windowId] = {};
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
  toolbar: ({windowId, tabId}) => {
    log('ua.toolbar is called', windowId, tabId);
    if (windowId) {
      chrome.tabs.query({
        windowId
      }, tabs => tabs.forEach(tab => {
        const tabId = tab.id;
        chrome.browserAction.setBadgeText({
          tabId,
          text: ua.object(null, windowId).platform.substr(0, 3)
        });
      }));
    }
    else if (tabId) {
      chrome.browserAction.setBadgeText({
        tabId,
        text: ua.object(tabId).platform.substr(0, 3)
      });
    }
  },
  update(str = prefs.ua, windowId = 'global') {
    log('ua.update is called', str, windowId);
    // clear caching
    Object.keys(cache).forEach(key => delete cache[key]);
    // remove old listeners
    chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
    chrome.webNavigation.onCommitted.removeListener(onCommitted);
    // apply new ones
    if (str || prefs.mode === 'custom' || this.windows.length) {
      ua.string(str, windowId);
      chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {
        'urls': ['*://*/*']
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
  chrome.windows.onRemoved.addListener(windowId => delete ua._obj[windowId]);
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
function match({url, tabId}) {
  log('match', url, tabId);
  const h = hostname(url);

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
  else {
    const [hh] = h.split(':');
    const key = Object.keys(expand.rules).filter(s => {
      if (s === h || s === hh) {
        return true;
      }
      else if (prefs.exactMatch === false) {
        return s.endsWith('.' + h) || h.endsWith('.' + s) || s.endsWith('.' + hh) || hh.endsWith('.' + s);
      }
    }).shift();
    let s = expand.rules[key] || expand.rules['*'];
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
      return !ua.object(tabId).userAgent;
    }
  }
}

const onBeforeSendHeaders = ({tabId, url, requestHeaders, type}) => {
  if (type === 'main_frame' || prefs.cache === false) {
    cache[tabId] = match({url, tabId});
  }
  if (cache[tabId] === true) {
    return {};
  }
  if (prefs.protected.some(s => url.indexOf(s) !== -1)) {
    return {};
  }
  const str = (cache[tabId] || ua.object(tabId)).userAgent;
  if (str) {
    for (let i = 0, name = requestHeaders[0].name; i < requestHeaders.length; i += 1, name = requestHeaders[i].name) {
      if (name === 'User-Agent' || name === 'user-agent') {
        requestHeaders[i].value = str === 'empty' ? '' : str;
        return {
          requestHeaders
        };
      }
    }
  }
};

const onCommitted = ({frameId, url, tabId}) => {
  if (url && (url.startsWith('http') || url.startsWith('ftp')) || url === 'about:blank') {
    if (cache[tabId] === true) {
      return;
    }
    const o = cache[tabId] || ua.object(tabId);
    if (o.userAgent) {
      chrome.tabs.executeScript(tabId, {
        runAt: 'document_start',
        frameId,
        code: `{
          const script = document.createElement('script');
          script.textContent = \`{
            const o = JSON.parse('${JSON.stringify(o)}');
            for (const key of Object.keys(o)) {
              navigator.__defineGetter__(key, () => {
                if (o[key] === '[delete]') {
                 return undefined;
                }
                else if (o[key] === 'empty') {
                  return '';
                }
                return o[key];
              });
            }
          }\`;
          document.documentElement.appendChild(script);
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
  if (frameId === 0 && ua.diff(tabId)) {
    ua.toolbar({tabId});
  }
};
// context menu
chrome.contextMenus.onClicked.addListener(info => chrome.storage.local.set({
  mode: info.menuItemId
}));

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
            tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
