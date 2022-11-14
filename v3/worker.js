const enable = () => chrome.storage.local.get({
  enabled: true
}, async prefs => {
  await chrome.scripting.unregisterContentScripts();

  if (prefs.enabled) {
    const common = {
      'matches': ['*://*/*'],
      'allFrames': true,
      'matchOriginAsFallback': true,
      'runAt': 'document_start'
    };

    await chrome.scripting.registerContentScripts([{
      ...common,
      'id': 'protected',
      'js': ['/data/inject/isolated.js'],
      'world': 'ISOLATED'
    }, {
      ...common,
      'id': 'unprotected',
      'js': ['/data/inject/main.js'],
      'world': 'MAIN'
    }]);
  }
});
chrome.runtime.onStartup.addListener(enable);
chrome.runtime.onInstalled.addListener(enable);

const policy = () => ({
  ua: 'Mozilla/5.0 (Windows NT 6.3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
  uad: true,
  major: 100,
  name: 'Google Chrome',
  mobile: false,
  platform: 'Windows',
  architecture: 'x86',
  bitness: '64',
  platformVersion: '10.0.0'
});

// web navigation
const onCommitted = d => {
  const p = policy(d);

  if (p) {
    chrome.scripting.executeScript({
      target: {
        tabId: d.tabId,
        frameIds: [d.frameId]
      },
      injectImmediately: true,
      func: p => {
        /* global port */
        if (typeof port === 'undefined') {
          self.prefs = p;
        }
        else {
          Object.assign(port.dataset, p);
        }
      },
      args: [p]
    });
  }
};
chrome.storage.local.get({
  enabled: true
}, prefs => {
  if (prefs.enabled) {
    chrome.webNavigation.onCommitted.addListener(onCommitted);
  }
});
