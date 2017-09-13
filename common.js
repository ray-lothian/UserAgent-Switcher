'use strict';

var ua = 'hi';

var onBeforeSendHeaders = ({requestHeaders}) => {
  for (let i = 0, name = requestHeaders[0].name; i < requestHeaders.length; i += 1, name = requestHeaders[i].name) {
    if (name === 'User-Agent' || name === 'user-agent') {
      requestHeaders[i].value = ua;
      return {
        requestHeaders
      };
    }
  }
};

var onCommitted = ({frameId, url, tabId}) => {
  if (frameId === 0 && url && (url.startsWith('http') || url.startsWith('ftp'))) {
    chrome.tabs.executeScript(tabId, {
      runAt: 'document_start',
      allFrames: true,
      code: `{
        const script = document.createElement('script');
        script.textContent = \`{
          navigator.__defineGetter__('userAgent', () => '${ua}');
        }\`;
        document.documentElement.appendChild(script);
      }`
    }, () => chrome.runtime.lastError);
  }
};

function update(str) {
  ua = str;
  if (ua) {
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
      16: 'data/icons/' + (ua ? 'active/' : '') + '16.png',
      32: 'data/icons/' + (ua ? 'active/' : '') + '32.png',
      48: 'data/icons/' + (ua ? 'active/' : '') + '48.png',
      64: 'data/icons/' + (ua ? 'active/' : '') + '64.png'
    }
  });
  chrome.browserAction.setTitle({
    title: `UserAgent Switcher (${ua ? 'enabled' : 'disabled'})

User-Agent String: ${ua || navigator.userAgent}`
  });
}

chrome.storage.local.get({
  ua: ''
}, prefs => update(prefs.ua));
chrome.storage.onChanged.addListener(prefs => {
  update(prefs.ua.newValue);
});
