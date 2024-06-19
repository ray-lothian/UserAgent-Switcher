/* global UAParser */
class Agent {
  #prefs = {}; // userAgentData, parser

  prefs(prefs) {
    this.#prefs = prefs;
  }
  parse(s = '') {
    // log('ua.parse is called', s);

    if (this.#prefs.parser[s]) {
      // log('ua.parse is resolved using parser');
      return Object.assign({
        userAgent: s
      }, this.#prefs.parser[s]);
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

      if (this.#prefs.userAgentData && p.browser && p.browser.major) {
        if (['Opera', 'Chrome', 'Edge'].includes(p.browser.name)) {
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
    return o;
  }
}

