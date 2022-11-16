/* global UAParser */
self.importScripts('./helper/ua-parser.min.js');

const PREFS = {
  'enabled': true,
  'mode': 'blacklist',
  'blacklist-exception-hosts': [],
  'whitelist-hosts': [],
  'custom-routing': {
    'whatismybrowser.com': 'ff'
  }
};

const policy = {};

{
  const cache = new Map();

  policy.parse = d => {
    const ua = 'Mozilla/5.0 (Windows NT 6.3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36';

    if (cache.has(ua)) {
      return cache.get(ua);
    }

    return new Promise(resolve => chrome.storage.local.get({
      'userAgentData': true
    }, prefs => {
      const p = (new UAParser(ua)).getResult();

      const r = {
        ua
      };
      r.uad = prefs.userAgentData &&
        p.browser && p.browser.major && ['Opera', 'Chrome', 'Edge'].includes(p.browser.name);

      if (r.uad) {
        r.platform = p?.os?.name || 'Windows';
        if (r.platform.toLowerCase().includes('mac')) {
          r.platform = 'macOS';
        }
        else if (r.platform.toLowerCase().includes('debian')) {
          r.platform = 'Linux';
        }

        r.major = p?.browser?.major || 100;

        r.name = p?.browser?.name || 'Google Chrome';
        if (r.name === 'Chrome') {
          r.name = 'Google Chrome';
        }

        r.mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

        r.architecture = 'x86';

        r.bitness = '64';

        r.platformVersion = '10.0.0';
      }

      cache.set(ua, r);

      resolve(r);
    }));
  };
}

policy.configure = (...methods) => new Promise(resolve => chrome.storage.local.get(PREFS, prefs => {
  for (const method of methods) {
    method(prefs);
  }
  resolve();
}));
