/* globals UAParser*/

'use strict';

var ua = {};

var prefs = {
  ua: '',
  blacklist: [],
  whitelist: [],
  custom: {},
  mode: 'blacklist'
};

chrome.storage.local.get(prefs, ps => {
  Object.assign(prefs, ps);
  update();
});
chrome.storage.onChanged.addListener(ps => {
  Object.keys(ps).forEach(key => prefs[key] = ps[key].newValue);
  if (ps.ua || ps.mode) {
    update();
  }
});

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
function match(url) {
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
      const o = {};
      o.userAgent = s;
      o.appVersion = s
        .replace(/^Mozilla\//, '')
        .replace(/^Opera\//, '');
      const p = new UAParser(s);
      o.platform = p.getOS().name || '';
      o.vendor = p.getDevice().vendor || '';

      return o;
    }
    else {
      return !ua.userAgent;
    }
  }
}

var cache = {};
chrome.tabs.onRemoved.addListener(id => delete cache[id]);

var onBeforeSendHeaders = ({tabId, url, requestHeaders, type}) => {
  if (type === 'main_frame') {
    cache[tabId] = match(url);
  }
  if (cache[tabId] === true) {
    return;
  }
  const str = (cache[tabId] || ua).userAgent;
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
    const o = cache[tabId] || ua;
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
        }`
      }, () => chrome.runtime.lastError);
    }
  }
};

function update() {
  if (prefs.ua || prefs.mode === 'custom') {
    if (prefs.ua) {
      ua.userAgent = prefs.ua;
      ua.appVersion = ua.userAgent
        .replace(/^Mozilla\//, '')
        .replace(/^Opera\//, '');
      const p = new UAParser(prefs.ua);
      ua.platform = p.getOS().name || '';
      ua.vendor = p.getDevice().vendor || '';
    }
    else {
      ua = {};
    }
    chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {
      'urls' : ['*://*/*']
    }, ['blocking', 'requestHeaders']);
    chrome.webNavigation.onCommitted.addListener(onCommitted);
  }
  else {
    chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
    chrome.webNavigation.onCommitted.removeListener(onCommitted);
  }

  chrome.browserAction.setIcon({
    path: {
      16: 'data/icons/' + (prefs.ua ? 'active/' : '') + '16.png',
      32: 'data/icons/' + (prefs.ua ? 'active/' : '') + '32.png',
      48: 'data/icons/' + (prefs.ua ? 'active/' : '') + '48.png',
      64: 'data/icons/' + (prefs.ua ? 'active/' : '') + '64.png'
    }
  });
  const custom = 'Mapped from user\'s JSON object if found, otherwise uses "' + (prefs.ua || navigator.userAgent) + '"';
  chrome.browserAction.setTitle({
    title: `UserAgent Switcher (${prefs.ua ? 'enabled' : 'disabled'})

User-Agent String: ${prefs.mode === 'custom' ? custom : prefs.ua || navigator.userAgent}`
  });
}

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
