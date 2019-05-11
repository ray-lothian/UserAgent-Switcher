/* globals UAParser */

'use strict';

var cache = {};
var tabs = {};
chrome.tabs.onRemoved.addListener(id => delete cache[id]);
chrome.tabs.onCreated.addListener(tab => tabs[tab.id] = tab.windowId);

var prefs = {
  ua: '',
  blacklist: [],
  whitelist: [],
  custom: {},
  mode: 'blacklist',
  color: '#ffa643',
  cache: true,
  exactMatch: false
};
chrome.storage.local.get(prefs, ps => {
  Object.assign(prefs, ps);
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
});

var ua = {
  _obj: {
    'global': {}
  },
  diff(tabId) { // returns true if there is per window object
    const windowId = tabs[tabId];
    return windowId in this._obj;
  },
  get windows() {
    return Object.keys(this._obj).filter(id => id !== 'global').map(s => Number(s));
  },
  parse: s => {
    const o = {};
    o.userAgent = s;
    o.appVersion = s
      .replace(/^Mozilla\//, '')
      .replace(/^Opera\//, '');
    const p = (new UAParser(s)).getResult();
    o.platform = p.os.name || '';
    o.vendor = p.device.vendor || '';
    o.product = p.engine.name || '';
    o.oscpu = ((p.os.name || '') + ' ' + (p.os.version || '')).trim();

    return o;
  },
  object(tabId, windowId) {
    windowId = windowId || (tabId ? tabs[tabId] : 'global');
    return this._obj[windowId] || this._obj.global;
  },
  string(str, windowId) {
    if (str) {
      this._obj[windowId] = this.parse(str);
    }
    else {
      this._obj[windowId] = {};
    }
  },
  toolbar: ({windowId, tabId, str = ua.object(tabId, windowId).userAgent}) => {
    const icon = {
      path: {
        16: 'data/icons/' + (str ? 'active/' : '') + '16.png',
        32: 'data/icons/' + (str ? 'active/' : '') + '32.png',
        48: 'data/icons/' + (str ? 'active/' : '') + '48.png',
        64: 'data/icons/' + (str ? 'active/' : '') + '64.png'
      }
    };
    const custom = 'Mapped from user\'s JSON object if found, otherwise uses "' + (str || navigator.userAgent) + '"';
    const title = {
      title: `UserAgent Switcher (${str ? 'enabled' : 'set to default'})

User-Agent String: ${prefs.mode === 'custom' ? custom : str || navigator.userAgent}`
    };
    if (windowId) {
      chrome.tabs.query({
        windowId
      }, tabs => tabs.forEach(tab => {
        const tabId = tab.id;
        chrome.browserAction.setTitle(Object.assign({tabId}, title));
        chrome.browserAction.setBadgeText({
          tabId,
          text: ua.object(null, windowId).platform.substr(0, 3)
        });
      }));
    }
    else if (tabId) {
      chrome.browserAction.setTitle(Object.assign({tabId}, title));
      chrome.browserAction.setBadgeText({
        tabId,
        text: ua.object(tabId).platform.substr(0, 3)
      });
    }
    else {
      chrome.browserAction.setIcon(icon);
      chrome.browserAction.setTitle(title);
    }
  },
  update(str = prefs.ua, windowId = 'global') {
    chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
    chrome.webNavigation.onCommitted.removeListener(onCommitted);

    if (str || prefs.mode === 'custom' || this.windows.length) {
      ua.string(str, windowId);
      chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {
        'urls': ['*://*/*']
      }, ['blocking', 'requestHeaders']);
      chrome.webNavigation.onCommitted.addListener(onCommitted);
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
// make sure to clean on window removal
if (chrome.windows) { // FF on Android
  chrome.windows.onRemoved.addListener(windowId => delete ua._obj[windowId]);
}

function hostname(url) {
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
  if (prefs.mode === 'blacklist') {
    if (prefs.blacklist.length) {
      const h = hostname(url);
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
      const h = hostname(url);
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
    const h = hostname(url);
    const key = Object.keys(prefs.custom).filter(s => {
      if (s === h) {
        return true;
      }
      else if (prefs.exactMatch === false) {
        return s.endsWith('.' + h) || h.endsWith('.' + s);
      }
    }).shift();
    let s = prefs.custom[key] || prefs.custom['*'];
    // if s is an array select a random string
    if (Array.isArray(s)) {
      s = s[Math.floor(Math.random() * s.length)];
      // set session mode if key is either on _[key] or _['*'] lists
      if (prefs.custom._ && Array.isArray(prefs.custom._)) {
        if (prefs.custom._.indexOf(key) !== -1) {
          prefs.custom[key] = s;
        }
        else if (prefs.custom._.indexOf('*') !== -1) {
          prefs.custom['*'] = s;
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

var onBeforeSendHeaders = ({tabId, url, requestHeaders, type}) => {
  if (type === 'main_frame' || prefs.cache === false) {
    cache[tabId] = match({url, tabId});
  }
  if (cache[tabId] === true) {
    return;
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

var onCommitted = ({frameId, url, tabId}) => {
  if (url && (url.startsWith('http') || url.startsWith('ftp')) || url === 'about:blank') {
    if (cache[tabId] === true) {
      return;
    }
    const o = cache[tabId] || ua.object(tabId);
    if (o.userAgent) {
      let {userAgent, appVersion, platform, vendor, product, oscpu} = o;
      if (o.userAgent === 'empty') {
        userAgent = appVersion = platform = vendor = product = '';
      }
      chrome.tabs.executeScript(tabId, {
        runAt: 'document_start',
        frameId,
        code: `{
          const script = document.createElement('script');
          script.textContent = \`{
            const userAgent = "${encodeURIComponent(userAgent)}";
            const appVersion = "${encodeURIComponent(appVersion)}";
            const platform = "${encodeURIComponent(platform)}";
            const vendor = "${encodeURIComponent(vendor)}";
            const product = "${encodeURIComponent(product)}";
            const oscpu = "${encodeURIComponent(oscpu)}";
            navigator.__defineGetter__('userAgent', () => decodeURIComponent(userAgent));
            navigator.__defineGetter__('appVersion', () => decodeURIComponent(appVersion));
            navigator.__defineGetter__('platform', () => decodeURIComponent(platform));
            navigator.__defineGetter__('vendor', () => decodeURIComponent(vendor));
            navigator.__defineGetter__('product', () => decodeURIComponent(product));
            navigator.__defineGetter__('oscpu', () => decodeURIComponent(oscpu));
            navigator.__defineGetter__('productSub', () => '');
          }\`;
          document.documentElement.appendChild(script);
          script.remove();
        }`
      }, () => chrome.runtime.lastError);
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

// FAQs & Feedback
{
  const {onInstalled, setUninstallURL, getManifest} = chrome.runtime;
  const {name, version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': true,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '?version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
  setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
}
