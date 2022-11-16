/* global port, policy */

const scripting = {};

scripting.page = async prefs => {
  await chrome.scripting.unregisterContentScripts();

  if (prefs.enabled) {
    const common = {
      'allFrames': true,
      'matchOriginAsFallback': true,
      'runAt': 'document_start'
    };
    if (prefs.mode === 'blacklist') {
      common.matches = ['*://*/*'];
      if (prefs['blacklist-exception-hosts'].length) {
        common.excludeMatches = prefs['blacklist-exception-hosts'].map(h => [`*://${h}/*`, `*://*.${h}/*`]).flat();
      }
    }
    else if (prefs['whitelist-hosts'].length) {
      common.matches = prefs['whitelist-hosts'].map(h => [`*://${h}/*`, `*://*.${h}/*`]).flat();
    }

    if (common.matches.length) {
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
    else {
      console.info('matching list is empty');
    }
  }
};

// web navigation
{
  const onCommitted = async d => {
    const p = await policy.parse(d);

    if (p) {
      chrome.scripting.executeScript({
        target: {
          tabId: d.tabId,
          frameIds: [d.frameId]
        },
        injectImmediately: true,
        func: p => {
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
  const onCommittedIgnore = d => {
    chrome.scripting.executeScript({
      target: {
        tabId: d.tabId,
        frameIds: [d.frameId]
      },
      injectImmediately: true,
      func: () => {
        if (typeof port === 'undefined') {
          port.dataset.enabled = false;
        }
        else {
          self.ingored = true;
        }
      }
    }).catch(() => {});
  };

  scripting.commit = prefs => {
    if (prefs.enabled && prefs.mode === 'blacklist') {
      chrome.webNavigation.onCommitted.addListener(onCommitted);
      if (prefs['blacklist-exception-hosts'].length) {
        chrome.webNavigation.onCommitted.addListener(onCommittedIgnore, {
          url: prefs['blacklist-exception-hosts'].map(hostContains => ({
            hostContains
          }))
        });
      }
    }
    else if (prefs['whitelist-hosts'].length) {
      chrome.webNavigation.onCommitted.addListener(onCommitted, {
        url: prefs['whitelist-hosts'].map(hostContains => ({
          hostContains
        }))
      });
    }
  };
}
