/* global UAParser */
class Agent {
  #prefs = {}; // userAgentData, parser

  async prefs(ps) {
    const dps = await chrome.storage.local.get(ps || {
      'mode': 'blacklist',
      'ua': '',
      'blacklist': [],
      'whitelist': [],
      'custom': {},
      'parser': {},
      'protected': [
        'google.com/recaptcha',
        'gstatic.com/recaptcha',
        'accounts.google.com',
        'accounts.youtube.com',
        'gitlab.com/users/sign_in'
      ],
      'userAgentData': true
    });
    this.#prefs = dps;

    // resolve configured { browser, os } objects into user-agent strings
    for (const domain of Object.keys(dps.custom)) {
      const value = dps.custom[domain];
      if (Array.isArray(value)) {
        dps.custom[domain] = await Promise.all(value.map((entry) => {
          return this.getUserAgentString(entry);
        }))
      } else {
        dps.custom[domain] = await this.getUserAgentString(value);
      }
    };

    return dps;
  }

  // JS-side mirror of the network layer's scope decision (network.js); the
  // async fallback must not spoof pages the DNR rules leave alone, or we
  // reintroduce the header/JS mismatch that Cloudflare flags. Keep the
  // host normalization in lockstep with Network#normalizeHost
  async resolveFor(url) {
    const dps = await this.prefs();

    let host = '';
    try {
      host = new URL(url).hostname;
    }
    catch (e) {
      return '';
    }

    const matches = list => (list || []).some(d => {
      const h = String(d).trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^\*\./, '')
        .split('/')[0]
        .split(':')[0]
        .replace(/\.$/, '');
      return h && (host === h || host.endsWith('.' + h));
    });
    const pick = v => Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;

    if (dps.mode === 'whitelist') {
      return dps.ua && matches(dps.whitelist) ? dps.ua : '';
    }
    if (dps.mode === 'custom') {
      // per-host entries override the global ua with their own value
      // (network.js registers them at a higher priority)
      for (const [hosts, value] of Object.entries(dps.custom || {})) {
        if (hosts === '*' || hosts === '_') {
          continue;
        }
        if (matches(hosts.split(/\s*,\s*/))) {
          return pick(value);
        }
      }
      // wildcard entry is the global override
      if (dps.custom && dps.custom['*']) {
        return pick(dps.custom['*']) || dps.ua || '';
      }
      // a global ua spoofs everything in this mode
      return dps.ua || '';
    }
    // blacklist: nothing set -> no spoof; protected URLs stay real on the
    // JS side too
    if (!dps.ua) {
      return '';
    }
    const regex = dps.protected
      .filter(c => typeof c === 'string' && c !== '')
      .map(c => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
      .join('|');
    if (regex && new RegExp(regex).test(url)) {
      return '';
    }
    return dps.ua;
  }

  parse(s = '') {
    // log('ua.parse is called', s);

    const parser = this.#prefs.parser || {};
    if (parser[s]) {
      // log('ua.parse is resolved using parser');
      return Object.assign({
        userAgent: s
      }, parser[s]);
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

    // platform
    if (p.os.name === 'Mac OS' || p.os.name === 'macOS') {
      o.platform = 'MacIntel';
    }
    else if (p.os.name === 'Windows') {
      o.platform = 'Win32';
    }
    else if (p.os.name === 'Linux') {
      o.platform = o.oscpu;
    }
    else if (p.os.name === 'Android') {
      if (p.cpu.architecture) {
        o.platform = 'Linux ' + p.cpu.architecture;
      }
      else {
        o.platform = 'Linux armv81';
      }
    }
    else if (p.os.name === 'iOS') {
      o.platform = p.device.model;
    }
    // backup plan
    o.platform = o.platform ||
      (p.cpu.architecture ? ('Linux ' + p.cpu.architecture) : (p.os.name || ''));


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
    o.userAgentData = '[delete]';
    if (isFF) {
      o.oscpu = ((p.os.name || '') + ' ' + (p.os.version || '')).trim();
      o.productSub = '20100101';
      o.buildID = '20181001000000';
    }
    else {
      o.oscpu = '[delete]';
      o.buildID = '[delete]';
      o.productSub = '20030107';

      // navigator.userAgentData only exists on Chromium-based browsers
      // (Chrome >= 90); unbranded Chromium reports a two-brand list and
      // Android Chrome parses as "Mobile Chrome"
      if (this.#prefs.userAgentData && p.browser && p.browser.major) {
        if (['Opera', 'Chrome', 'Edge', 'Chromium', 'Mobile Chrome'].includes(p.browser.name) &&
            /Chrome\/\d+/.test(s)) {
          o.userAgentDataBuilder = {p, ua: s};
          delete o.userAgentData;
        }
      }
    }

    if (o.userAgent === 'empty') {
      Object.keys(o).forEach(key => {
        if (key !== 'userAgent') {
          o[key] = '';
        }
      });
    }

    // The injected scripts must evaluate the same protected URLs as the
    // network layer (network.js), so a protected page never ends up with a
    // spoofed navigator on top of its real request headers
    o.protected = this.#prefs.protected || [];

    return o;
  }

  /**
   * If a user-acent string is passed, just return it.
   * If it is a { browser, os } configuration object, resolve it to the newest agent.
   */
  async getUserAgentString(value) {
    if (typeof value === "string") {
      return value;
    }

    const { browser, os } = value;
    const response = await fetch('/data/popup/browsers/' + browser.toLowerCase() + '-' + os.toLowerCase().replace(/\//g, '-') + '.json');
    const list = this.sort(await response.json());
    return list[0].ua;
  }

  /**
   * Sort the newest user agent to the top.
   */
  sort(arr) {
    function sort(a = '', b = '') {
      const pa = a.split('.');
      const pb = b.split('.');
      for (let i = 0; i < 3; i++) {
        const na = Number(pa[i]);
        const nb = Number(pb[i]);
        if (na > nb) {
          return -1;
        }
        if (nb > na) {
          return 1;
        }
        if (!isNaN(na) && isNaN(nb)) {
          return -1;
        }
        if (isNaN(na) && !isNaN(nb)) {
          return 1;
        }
      }
      return 0;
    }
    return arr.sort((a, b) => sort(a.browser.version, b.browser.version));
  }
}

