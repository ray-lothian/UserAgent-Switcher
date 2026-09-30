// console.log('override.js');
{
  // escapes the protected list exactly like the network layer does
  // (network.js -> regexFilter), so both layers evaluate the same URLs; a
  // mismatch would leave a page with real headers but a spoofed navigator,
  // which is what Cloudflare compares during challenges
  const protectedRegex = list => {
    const regex = (list || [])
      .filter(c => typeof c === 'string' && c !== '')
      .map(c => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
      .join('|');
    return regex ? new RegExp(regex) : null;
  };

  // ------------------------------------------------------------------------
  // user-agent client hints generation. The network layer (network.js ->
  // #clientHints) builds the Sec-CH-UA* request headers from the exact same
  // algorithms; keep the two implementations in sync or a page ends up with
  // navigator data that disagrees with its own request headers
  // ------------------------------------------------------------------------

  // Chromium derives the GREASE brand and the brands order from the browser's
  // major version (components/embedder_support/user_agent_utils.cc ->
  // GetGreasedUserAgentBrandVersion + ShuffleBrandList); a hardcoded
  // "Not/A)Brand";v="8" with a fixed order is a reliable detection signal.
  // Verified against Chrome 154: major 154 -> "Not A(Brand";v="99" with order
  // [Chromium, Google Chrome, Not A(Brand]
  const greaseyChars = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
  const greasedVersions = ['8', '99', '24'];
  // the stable permutations Chromium uses to shuffle [grease, Chromium, brand]
  const brandOrders = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
  ];

  const greaseBrand = major => {
    const m = Number(major);
    if (Number.isInteger(m) && m >= 0) {
      return {
        brand: 'Not' + greaseyChars[m % greaseyChars.length] + 'A' +
          greaseyChars[(m + 1) % greaseyChars.length] + 'Brand',
        version: greasedVersions[m % greasedVersions.length]
      };
    }
    // unknown major -> the legacy pair this extension always used
    return {brand: 'Not/A)Brand', version: '8'};
  };

  // brands carry their commercial name, not the UA token; Android Chrome
  // parses as "Mobile Chrome" but reports the regular "Google Chrome" brand
  const brandName = name => {
    if (name === 'Chrome' || name === 'Mobile Chrome') {
      return 'Google Chrome';
    }
    if (name === 'Edge') {
      return 'Microsoft Edge';
    }
    return name || 'Chromium';
  };

  const fullVersionOf = (ua, token) => {
    const m = (ua || '').match(new RegExp(token + '\\/(\\d+(?:\\.\\d+)*)'));
    return m ? m[1] : '';
  };

  // the browser brand's full version; Edge and Opera report their own full
  // version next to the Chromium core one
  const browserFullVersionOf = (p, ua) => {
    const name = p?.browser?.name || 'Chrome';
    const major = String(p?.browser?.major || '');
    const chromeFull = fullVersionOf(ua, 'Chrome') || (major ? major + '.0.0.0' : '');
    if (name === 'Edge') {
      return fullVersionOf(ua, 'Edg(?:e|A|iOS)?') || chromeFull;
    }
    if (name === 'Opera') {
      return fullVersionOf(ua, 'OPR') || chromeFull;
    }
    return chromeFull;
  };

  // builds the brands list (full=false) or the fullVersionList shape (full=
  // true) where every entry carries its full version and the GREASE entry
  // extends its major-only version with ".0.0.0"
  // (GetProcessedGreasedBrandVersion)
  const brandListOf = (p, ua, full) => {
    const browser = p?.browser || {};
    const name = browser.name || 'Chrome';
    const major = String(browser.major || '');
    const g = greaseBrand(major);
    const m = Number(major);
    const seed = Number.isInteger(m) && m >= 0 ? m : 0;

    // the Chromium entry always reflects the Chromium core (the Chrome/ token
    // of the UA), not the browser brand's own version; Opera for example
    // reports "Opera";v="105", "Chromium";v="119"
    const chromeFull = fullVersionOf(ua, 'Chrome') || (major ? major + '.0.0.0' : '');
    const chromeMajor = chromeFull.split('.')[0] || major;

    let list = [{
      brand: g.brand,
      version: full ? g.version + '.0.0.0' : g.version
    }, {
      brand: 'Chromium',
      version: full ? chromeFull : chromeMajor
    }, {
      brand: brandName(name),
      version: full ? browserFullVersionOf(p, ua) : major
    }];

    // Edge and Opera prepend their own brand instead of shuffling; unbranded
    // Chromium only reports two brands
    if (name === 'Edge' || name === 'Opera') {
      list = [list[2], list[1], list[0]];
    }
    else if (name === 'Chromium') {
      list = [list[0], list[1]];
      const shuffled = [];
      [seed % 2, (seed + 1) % 2].forEach((pos, i) => shuffled[pos] = list[i]);
      list = shuffled;
    }
    else {
      const shuffled = [];
      brandOrders[seed % brandOrders.length].forEach((pos, i) => shuffled[pos] = list[i]);
      list = shuffled;
    }
    // real Chrome returns a frozen array (the entries themselves are not)
    return Object.freeze(list);
  };

  // real Chrome only reports the 8 platform values from the spec
  // (https://wicg.github.io/ua-client-hints/#sec-ch-ua-platform); leaking
  // "Ubuntu" instead of "Linux" or "Chromium OS" instead of "Chrome OS" is a
  // giveaway
  const platformOf = os => {
    const name = (os?.name || '').toLowerCase();
    if (name.includes('mac')) {
      return 'macOS';
    }
    if (name.includes('windows')) {
      return 'Windows';
    }
    if (name.includes('android')) {
      return 'Android';
    }
    if (name.includes('ios')) {
      return 'iOS';
    }
    if (name.includes('chrome os') || name.includes('chromium os')) {
      return 'Chrome OS';
    }
    if (name.includes('fuchsia')) {
      return 'Fuchsia';
    }
    // every Linux distribution (Ubuntu, Debian, Fedora, Mint, ...) reports
    // plain "Linux"
    if (/linux|debian|ubuntu|fedora|mint|centos|red ?hat|arch|suse|gentoo|kubuntu|xubuntu|lubuntu|kali|manjaro|deepin|raspbian|elementary|zorin|pop!_os|mandriva|pclinuxos|zenwalk/.test(name)) {
      return 'Linux';
    }
    return 'Unknown';
  };

  // Chrome never reports the raw OS version: Windows goes through the
  // UniversalApiContract mapping (Win10 -> "13.0.0", Win8.1 -> "0.3.0", ...),
  // Linux and Fuchsia report "", the rest reports "major.minor.patch"
  // (https://wicg.github.io/ua-client-hints/#get-the-platform-version)
  const platformVersionOf = (p, ua) => {
    const name = (p?.os?.name || '').toLowerCase();
    if (name.includes('windows')) {
      const m = (ua || '').match(/Windows NT ([\d.]+)/);
      // Windows 11 also sends "Windows NT 10.0"; "13.0.0" is the Windows 10
      // contract version reported when the OS build is unknown
      return {
        '10.0': '13.0.0',
        '6.3': '0.3.0',
        '6.2': '0.2.0',
        '6.1': '0.1.0'
      }[m ? m[1] : ''] || '13.0.0';
    }
    if (name.includes('mac') || name.includes('android') || name.includes('ios')) {
      const m = name.includes('mac') ?
        (ua || '').match(/Mac OS X ([\d_]+)/) :
        name.includes('android') ?
          (ua || '').match(/Android (\d+(?:\.\d+)*)/) :
          (ua || '').match(/OS (\d+(?:[._]\d+)*) like Mac OS X/);
      const fallback = name.includes('mac') ? '10.15.7' : '10.0.0';
      // create a unified platform version string (spec algorithm): three
      // integer components, invalid or missing ones become "0"
      const parts = ((m ? m[1] : p?.os?.version) || fallback)
        .replace(/_/g, '.').split('.')
        .map(s => /^\d+$/.test(s) ? s : '0');
      while (parts.length < 3) {
        parts.push('0');
      }
      return parts.slice(0, 3).join('.');
    }
    // Linux, Fuchsia and anything else report the empty string
    return '';
  };

  // Chrome maps every CPU architecture to "x86" or "arm" and reports "" on
  // Android (https://wicg.github.io/ua-client-hints/#user-agent-platform-architecture)
  const architectureOf = (p, ua, mobile) => {
    if (mobile) {
      return '';
    }
    if ((p?.cpu?.architecture || '').toLowerCase().includes('arm') ||
        /aarch64|armv[3-8]|\barm\b|arm mac os x/i.test(ua || '')) {
      return 'arm';
    }
    return 'x86';
  };

  // a 32-bit browser on 64-bit Windows ("WOW64" in the UA) reports "32"
  const bitnessOf = (ua, mobile) => {
    return mobile ? '' : (/wow64/i.test(ua || '') ? '32' : '64');
  };

  // the spec requires "" when mobileness is false; Android carries the model
  // in the UA ("Android 10; K" -> "K", "...; SM-G960F Build/..." -> "SM-G960F")
  const modelOf = (p, ua, mobile) => {
    if (!mobile) {
      return '';
    }
    const m = (ua || '').match(/Android[^;)]*; ?([^;)]+)/);
    return (m ? m[1] : (p?.device?.model || '')).split(/\s+Build\b/)[0].trim();
  };

  // ------------------------------------------------------------------------
  // prototype-level spoofing. Placing the accessors on the navigator's
  // prototype (like the real browser does) closes the classic detection
  // vector of reading the original value through the prototype descriptor:
  // Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent')
  //   .get.call(navigator)
  // must return the spoofed value, and the navigator instance must not carry
  // any own property (real Chrome has none)
  // ------------------------------------------------------------------------

  // builds a named accessor whose name, arity and toString() output match the
  // native ones (verified on Chrome 154: "function get userAgent() {
  // [native code] }")
  const nativeGetter = (key, get) => {
    const getter = {
      [key]: function() {
        return get(this);
      }
    }[key];
    Object.defineProperty(getter, 'name', {
      value: 'get ' + key,
      configurable: true
    });
    getter.toString = () => `function get ${key}() { [native code] }`;
    return getter;
  };

  // defines the accessor on the navigator's prototype and falls back to the
  // instance when the prototype is frozen (or inaccessible, e.g. Firefox
  // Xray wrappers) so spoofing never silently fails
  const define = (nav, key, get) => {
    const getter = nativeGetter(key, get);
    const proto = Object.getPrototypeOf(nav);
    try {
      proto.__defineGetter__(key, getter);
    }
    catch (e) {
      console.info('[User-Agent Switcher and Manager]', 'prototype define failed for', key, e);
      nav.__defineGetter__(key, getter);
    }
  };

  const override = (nav, reason, win = null) => {
    if (port.dataset.ready !== 'true') {
      port.prepare();
    }

    // keep the JS layer consistent with the network layer: when the URL is
    // protected, its request headers were already left untouched (DNR
    // allowAllRequests), so the navigator must stay real as well
    const regex = protectedRegex(port.prefs.protected);
    if (regex) {
      let href = location.href;
      if (win) { // overriding a registered frame's navigator, not ours
        try {
          href = win.location.href;
        }
        catch (e) {}
      }
      if (regex.test(href)) {
        if (!win) {
          port.dataset.disabled = 'true';
        }
        console.info('[User-Agent Switcher and Manager]', 'skipped (protected URL)', href);
        return;
      }
    }

    try {
      if (port.prefs.userAgentDataBuilder) {
        const b = port.prefs.userAgentDataBuilder;
        const ua = b.ua || '';
        const p = b.p || {};
        // keep the exact same mobileness regex as the network layer
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

        const v = new class NavigatorUAData {
          #d;
          constructor(d) {
            this.#d = d;
          }
          // brands/mobile/platform are prototype accessors in real Chrome
          get brands() {
            return this.#d.brands;
          }
          get mobile() {
            return this.#d.mobile;
          }
          get platform() {
            return this.#d.platform;
          }
          toJSON() {
            return {
              brands: this.brands,
              mobile: this.mobile,
              platform: this.platform
            };
          }
          getHighEntropyValues(hints) {
            // verified against Chrome 154: invalid hints reject the promise
            // (they do not throw synchronously) with this exact TypeError;
            // unknown hints are silently ignored and matching is case-sensitive
            if (hints === null || typeof hints !== 'object' ||
                typeof hints[Symbol.iterator] !== 'function') {
              return Promise.reject(new TypeError(
                'Failed to execute \'getHighEntropyValues\' on \'NavigatorUAData\':' +
                ' The provided value cannot be converted to a sequence.'
              ));
            }
            const list = [...hints];
            const d = this.#d;
            // UADataValues members serialize in declaration (alphabetical) order
            const r = {};
            if (list.includes('architecture')) {
              r.architecture = d.architecture;
            }
            if (list.includes('bitness')) {
              r.bitness = d.bitness;
            }
            r.brands = d.brands;
            if (list.includes('formFactors')) {
              r.formFactors = d.formFactors;
            }
            if (list.includes('fullVersionList')) {
              r.fullVersionList = d.fullVersionList;
            }
            r.mobile = d.mobile;
            if (list.includes('model')) {
              r.model = d.model;
            }
            r.platform = d.platform;
            if (list.includes('platformVersion')) {
              r.platformVersion = d.platformVersion;
            }
            if (list.includes('uaFullVersion')) {
              r.uaFullVersion = d.uaFullVersion;
            }
            if (list.includes('wow64')) {
              r.wow64 = d.wow64;
            }
            return Promise.resolve(r);
          }
        }({
          brands: brandListOf(p, ua, false),
          fullVersionList: brandListOf(p, ua, true),
          mobile,
          platform: platformOf(p.os),
          platformVersion: platformVersionOf(p, ua),
          architecture: architectureOf(p, ua, mobile),
          bitness: bitnessOf(ua, mobile),
          model: modelOf(p, ua, mobile),
          formFactors: [mobile ? 'Mobile' : 'Desktop'],
          wow64: false,
          uaFullVersion: browserFullVersionOf(p, ua)
        });

        // real Chrome reports "[object NavigatorUAData]"
        Object.defineProperty(Object.getPrototypeOf(v), Symbol.toStringTag, {
          value: 'NavigatorUAData'
        });

        // native method/constructor toString() outputs (verified on
        // Chrome 154); the methods' name, arity and the constructor's
        // .prototype presence already match
        for (const [fn, source] of [
          [v.toJSON, 'function toJSON() { [native code] }'],
          [v.getHighEntropyValues, 'function getHighEntropyValues() { [native code] }'],
          [v.constructor, 'function NavigatorUAData() { [native code] }']
        ]) {
          fn.toString = () => source;
        }

        define(nav, 'userAgentData', () => {
          return v;
        });
      }
      delete port.prefs.userAgentDataBuilder;

      for (const key of Object.keys(port.prefs)) {
        if (key === 'type' || key === 'protected') {
          continue;
        }
        if (port.prefs[key] === '[delete]') {
          delete Object.getPrototypeOf(nav)[key];
        }
        else {
          define(nav, key, () => {
            if (port.prefs[key] === 'empty') {
              return '';
            }
            return port.prefs[key];
          });
        }
      }
    }
    catch (e) {
      console.error('UA_SET_FAILED', e);
    }
  };

  const port = document.getElementById('uas-port');
  port.addEventListener('override', e => {
    if (e.detail.id === port.dataset.id) {
      override(navigator, e.detail.reason);
    }
    else {
      try {
        const win = port.ogs.get(e.detail.id);
        override(win.navigator, e.detail.reason, win);
      }
      catch (err) {
        console.info('[Failed to override]', err);
      }
    }
  });
}
