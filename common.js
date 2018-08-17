/* globals UAParser*/

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
  color: '#ffa643'
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
    const p = new UAParser(s);
    o.platform = p.getOS().name || '';
    o.vendor = p.getDevice().vendor || '';

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
      title: `UserAgent Switcher (${str ? 'enabled' : 'disabled'})

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
      return prefs.blacklist.some(s => s === h);
    }
  }
  else if (prefs.mode === 'whitelist') {
    if (prefs.whitelist.length) {
      const h = hostname(url);
      return prefs.whitelist.some(s => s === h) === false;
    }
    else {
      return true;
    }
  }
  else {
    const h = hostname(url);
    let s = prefs.custom[h] || prefs.custom['*'];
    // if s is an array select a random string
    if (Array.isArray(s)) {
      s = s[Math.floor(Math.random() * s.length)];
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
  if (type === 'main_frame') {
    cache[tabId] = match({url, tabId});
  }
  if (cache[tabId] === true) {
    return;
  }
  const str = (cache[tabId] || ua.object(tabId)).userAgent;
  if (str) {
    for (let i = 0, name = requestHeaders[0].name; i < requestHeaders.length; i += 1, name = requestHeaders[i].name) {
      if (name === 'User-Agent' || name === 'user-agent') {
        requestHeaders[i].value = str;
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
      chrome.tabs.executeScript(tabId, {
        runAt: 'document_start',
        frameId,
        code: `{
          const script = document.createElement('script');
          script.textContent = \`{
            navigator.__defineGetter__('userAgent', () => '${o.userAgent}');
            navigator.__defineGetter__('appVersion', () => '${o.appVersion}');
            navigator.__defineGetter__('platform', () => '${o.platform}');
            navigator.__defineGetter__('vendor', () => '${o.vendor}');
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

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': false,
  'last-update': 0
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 45 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '?version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        });
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '?rd=feedback&name=' + name + '&version=' + version
  );
}
