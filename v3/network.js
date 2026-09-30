/* global Agent */

// eslint-disable-next-line no-unused-vars
class Network {
  #CUSTOM_INDEX = 1000;
  #MAX_CUSTOM_RULES = 200;
  #PROTECTED_INDEX = 2000;
  #MAX_PROTECTED_RULES = 50;
  #PERTAB_INDEX = 3000;
  #MAX_PERTAB_RULES = 200;
  #ISFARARI = location.protocol.startsWith('safari-');

  // where the network layer actually changes the user-agent; the content
  // scripts must be registered on exactly the same scope
  #scope = {all: false, include: [], exclude: []};

  // normalizes user input into a DNR-compatible hostname ('' when invalid);
  // both the network rules and the injection scope must consume the exact
  // same normalized values to stay in sync
  #normalizeHost(host) {
    const h = String(host).trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^\*\./, '')
      .split('/')[0]
      .split(':')[0]
      .replace(/\.$/, '');
    return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(h) ? h : '';
  }

  // converts an already normalized hostname into a match pattern
  #pattern(host) {
    return '*://*.' + host + '/*';
  }

  // Safari does not support "object", "csp_report", "webtransport", "webbundle"
  #RESOURCETYPE = Object.values(chrome.declarativeNetRequest.ResourceType || [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'xmlhttprequest', 'ping',
    'media', 'websocket', 'other'
  ]);

  #busy = false;
  #pending = false;
  #current = Promise.resolve();

  // concurrent requests never interleave: while one run is in-flight the
  // others collapse into a single rerun that applies with fresh prefs once
  // the run settles
  configure() {
    if (this.#busy) {
      this.#pending = true;
      return this.#current;
    }
    this.#busy = true;
    this.#current = this.#drain();
    return this.#current;
  }
  async #drain() {
    while (true) {
      this.#pending = false;
      try {
        await this.#configure();
      }
      catch (e) {
        console.error('[network] configure failed', e);
      }
      if (!this.#pending) {
        break;
      }
    }
    this.#busy = false;
  }
  async #configure() {
    const agent = new Agent();
    const dps = await agent.prefs();

    this.#scope = {all: false, include: [], exclude: []};
    try {
      await this.dnet(agent, dps);
    }
    catch (e) {
      // updateDynamicRules is atomic; stale dynamic rules might still be active
      console.error('[network] dynamic rules failed', e);
    }

    let perTab = 0;
    try {
      const sps = await chrome.storage.session.get(null);
      perTab = await this.snet(agent, sps);
    }
    catch (e) {
      // commit failed atomically -> old per-tab rules may still be active;
      // keep global injection so those tabs never run without it
      perTab = 1;
      console.error('[network] session rules failed', e);
    }

    await this.page(perTab);
  }
  // builds the Sec-CH-UA* header values from the parsed agent. The JS layer
  // (data/inject/override.js) derives the navigator data from the exact same
  // algorithms; keep the two implementations in sync or a page ends up with
  // navigator data that disagrees with its own request headers
  #clientHints(p, ua) {
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
    const brandListOf = (p, ua) => {
      const browser = p?.browser || {};
      const name = browser.name || 'Chrome';
      const major = String(browser.major || '');
      const g = greaseBrand(major);
      const m = Number(major);
      const seed = Number.isInteger(m) && m >= 0 ? m : 0;

      // the Chromium entry always reflects the Chromium core (the Chrome/
      // token of the UA), not the browser brand's own version; Opera for
      // example reports "Opera";v="105", "Chromium";v="119"
      const chromeMajor = (ua || '').match(/Chrome\/(\d+)/)?.[1] || major;

      let list = [{
        brand: g.brand,
        version: g.version
      }, {
        brand: 'Chromium',
        version: chromeMajor
      }, {
        brand: brandName(name),
        version: major
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
      return list;
    };
    // real Chrome only reports the 8 platform values from the spec
    // (https://wicg.github.io/ua-client-hints/#sec-ch-ua-platform); leaking
    // "Ubuntu" instead of "Linux" or "Chromium OS" instead of "Chrome OS" is a
    // giveaway
    const platform = os => {
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

    return {
      platform: platform(p?.os),
      secChUa: brandListOf(p, ua).map(e => `"${e.brand}";v="${e.version}"`).join(', '),
      mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua || '')
    };
  }
  action(o, ...types) {
    const r = {
      'type': 'modifyHeaders'
    };
    if (types.includes('net')) {
      r.requestHeaders = [{
        'header': 'user-agent',
        'operation': 'set',
        'value': o.userAgent
      }];

      const chrs = this.#ISFARARI ? [] : [
        'sec-ch-ua-platform', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-arch', 'sec-ch-ua-bitness',
        'sec-ch-ua-full-version', 'sec-ch-ua-full-version-list', 'sec-ch-ua-model', 'sec-ch-ua-platform-version'
      ];
      if (o.userAgentDataBuilder) {
        const hints = this.#clientHints(o.userAgentDataBuilder.p, o.userAgentDataBuilder.ua);
        if (!this.#ISFARARI) {
          r.requestHeaders.push({
            'header': 'sec-ch-ua-platform',
            'operation': 'set',
            'value': '"' + hints.platform + '"'
          }, {
            'header': 'sec-ch-ua',
            'operation': 'set',
            'value': hints.secChUa
          }, {
            'header': 'sec-ch-ua-mobile',
            'operation': 'set',
            'value': hints.mobile ? '?1' : '?0'
          });
        }
        // remove unsupported Chrome headers
        for (const header of chrs) {
          if (['sec-ch-ua-platform', 'sec-ch-ua', 'sec-ch-ua-mobile'].includes(header)) {
            continue;
          }
          r.requestHeaders.push({
            header,
            'operation': 'remove'
          });
        }
      }
      else {
        for (const header of chrs) {
          r.requestHeaders.push({
            header,
            'operation': 'remove'
          });
        }
      }
    }
    if (types.includes('js')) {
      r.responseHeaders = [{
        'header': 'Server-Timing',
        'operation': 'set',
        'value': `uasw-json-data;dur=0;desc="${encodeURIComponent(JSON.stringify(o))}"`
      }];
    }
    return r;
  }
  async dnet(agent, prefs) {
    const addRules = [];

    const o = agent.parse(prefs.ua);
    o.type = 'user';

    if (prefs.ua && prefs.mode === 'blacklist') {
      this.#scope.all = true;
      const blacklist = prefs.blacklist.map(h => this.#normalizeHost(h)).filter(Boolean);
      this.#scope.exclude = blacklist;
      const r1 = {
        'id': 1,
        'priority': 1,
        'action': this.action(o, 'net'),
        'condition': {
          'resourceTypes': this.#RESOURCETYPE
        }
      };
      const r2 = {
        'id': 2,
        'priority': 1,
        'action': this.action(o, 'js'),
        // 'other' keeps the JS marker alive on service-worker-relayed
        // navigations; the inner fetch() of a SW passthrough is classified
        // as 'other' while its request headers are already spoofed by r1
        'condition': {
          'resourceTypes': ['main_frame', 'sub_frame', 'other']
        }
      };
      if (blacklist.length) {
        r1.condition.excludedRequestDomains = r2.condition.excludedRequestDomains = blacklist;
      }
      addRules.push(r1, r2);
    }
    else if (prefs.ua && prefs.mode === 'whitelist') {
      const whitelist = prefs.whitelist.map(h => this.#normalizeHost(h)).filter(Boolean);
      this.#scope.include = whitelist;
      if (whitelist.length) {
        addRules.push({
          'id': 1,
          'priority': 1,
          'action': this.action(o, 'net'),
          'condition': {
            'initiatorDomains': whitelist,
            'excludedResourceTypes': ['main_frame', 'sub_frame']
          }
        }, {
          'id': 2,
          'priority': 1,
          'action': this.action(o, 'net'),
          'condition': {
            'requestDomains': whitelist,
            'resourceTypes': ['main_frame', 'sub_frame']
          }
        }, {
          'id': 3,
          'priority': 1,
          'action': this.action(o, 'net', 'js'),
          // 'other' keeps the JS marker alive on SW-relayed navigations
          'condition': {
            'requestDomains': whitelist,
            'resourceTypes': ['main_frame', 'sub_frame', 'other']
          }
        });
      }
    }
    else if (prefs.mode === 'custom') {
      if (prefs.custom['*'] || prefs.ua) {
        this.#scope.all = true;
        const ua = Array.isArray(prefs.custom['*']) ?
          prefs.custom['*'][Math.floor(Math.random() * prefs.custom['*'].length)] :
          (prefs.custom['*'] || prefs.ua);

        const o = agent.parse(ua);
        o.type = prefs.custom['*'] ? '*' : 'user';

        addRules.push({
          'id': 1,
          'priority': 1,
          'action': this.action(o, 'net'),
          'condition': {
            'resourceTypes': this.#RESOURCETYPE
          }
        }, {
          'id': 2,
          'priority': 1, // for custom ones to be called after
          'action': this.action(o, 'js'),
          // 'other' keeps the JS marker alive on SW-relayed navigations
          'condition': {
            'resourceTypes': ['main_frame', 'sub_frame', 'other']
          }
        });
      }
      let n = this.#CUSTOM_INDEX;
      for (const [hosts, value] of Object.entries(prefs.custom)) {
        if (hosts === '*' || hosts === '_') {
          continue;
        }

        const ua = Array.isArray(value) ? value[Math.floor(Math.random() * value.length)] : value;
        const o = agent.parse(ua);
        o.type = 'custom';

        const domains = hosts.split(/\s*,\s*/).map(h => this.#normalizeHost(h)).filter(Boolean);
        if (domains.length === 0) {
          console.error('IGNORING_CUSTOM', hosts, 'no valid hostname');
          continue;
        }
        this.#scope.include.push(...domains);

        addRules.push({
          'id': n,
          'priority': 2,
          'action': this.action(o, 'net'),
          'condition': {
            'initiatorDomains': domains,
            'excludedResourceTypes': ['main_frame', 'sub_frame']
          }
        }, {
          'id': n + 1,
          'priority': 2,
          'action': this.action(o, 'net', 'js'),
          // 'other' keeps the JS marker alive on SW-relayed navigations
          'condition': {
            'requestDomains': domains,
            'resourceTypes': ['main_frame', 'sub_frame', 'other']
          }
        });

        n += 2;

        if (n > this.#CUSTOM_INDEX + this.#MAX_CUSTOM_RULES) {
          console.info('Some custom rules are ignored', 'max reached');
          break;
        }
      }
    }

    if (addRules.length && prefs.protected.length) {
      let n = this.#PROTECTED_INDEX;
      let rule = '';
      const rules = new Map();
      for (const c of prefs.protected) {
        const regex = c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
        const v = await chrome.declarativeNetRequest.isRegexSupported({
          regex
        });
        if (v.isSupported) {
          const tmp = rule + (rule !== '' ? '|' : '') + regex;
          const w = await chrome.declarativeNetRequest.isRegexSupported({
            regex: tmp
          });
          if (w.isSupported) {
            rule = tmp;
          }
          else {
            rules.set(n, rule);
            rule = regex;
            n += 1;
          }
        }
        else {
          console.error('IGNORING_PROTECTED', c, v.reason);
        }
      }
      if (rule !== '') {
        rules.set(n, rule);
      }
      for (const [id, regexFilter] of rules.entries()) {
        if (id >= this.#PROTECTED_INDEX + this.#MAX_PROTECTED_RULES) {
          break;
        }
        addRules.push({
          id,
          'priority': 4, // to discard all headers even set-cookie
          'action': {
            'type': 'allowAllRequests' // only allowAllRequests can bypass set-cookie header
          },
          'condition': {
            'resourceTypes': ['main_frame', 'sub_frame'],
            regexFilter
          }
        });
      }
    }

    const removeRuleIds = await chrome.declarativeNetRequest.getDynamicRules().then(arr => arr.map(o => o.id));
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules,
      removeRuleIds
    });

    if (addRules.length) {
      console.info('[network] dynamic rules', {
        mode: prefs.mode,
        rules: addRules,
        scope: {...this.#scope}
      });
    }
    else {
      console.info('[network] dynamic rules', 'disabled');
    }

    return addRules.length;
  }
  async snet(agent, prefs) {
    // per-tab rules
    const addRules = [];

    let m = this.#PERTAB_INDEX;
    for (const [key, {ua}] of Object.entries(prefs)) {
      if (!ua) {
        continue;
      }
      const o = agent.parse(ua);
      o.type = 'per-tab';

      const tabIds = key.split(',').map(Number);
      addRules.push({
        'id': m,
        'priority': 3,
        'action': this.action(o, 'net'),
        'condition': {
          tabIds,
          'resourceTypes': this.#RESOURCETYPE
        }
      }, {
        'id': m + 1,
        'priority': 3, // to override the global set-cookie with priority 2
        'action': this.action(o, 'js'),
        'condition': {
          tabIds,
          'resourceTypes': ['main_frame', 'sub_frame']
        }
      });

      m += 2;

      if (m > this.#PERTAB_INDEX + this.#MAX_PERTAB_RULES) {
        console.info('max of per-tab rule reach', 'ignoring other tabs');
        break;
      }
    }

    const removeRuleIds = await chrome.declarativeNetRequest.getSessionRules().then(arr => arr.map(o => o.id));
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules,
      removeRuleIds
    }).then(() => addRules.length);

    if (addRules.length) {
      console.info('[network] per-tab session rules', {
        rules: addRules,
        tabs: addRules.filter(r => r.condition.tabIds).flatMap(r => r.condition.tabIds)
      });
    }
    else {
      console.info('[network] per-tab session rules', 'disabled');
    }

    return addRules.length;
  }
  // registers all three content scripts; rejects on the first failure
  async #register(props) {
    const scripts = [{
      'id': 'main',
      'js': ['/data/inject/main.js'],
      'world': 'MAIN'
    }, {
      'id': 'override',
      'js': ['/data/inject/override.js'],
      'world': 'MAIN'
    }, {
      'id': 'isolated',
      'js': ['/data/inject/isolated.js'],
      'world': 'ISOLATED'
    }];
    // since order is important, do not register simultaneously
    for (const script of scripts) {
      await chrome.scripting.registerContentScripts([{
        ...script,
        ...props
      }]);
    }
  }
  async page(perTab = 0) {
    await chrome.scripting.unregisterContentScripts().catch(e => {
      console.error('[injection] unregister failed', e);
    });

    const {all, include, exclude} = this.#scope;
    const uniq = [...new Set(include)];
    const patterns = uniq.map(d => this.#pattern(d)).filter(Boolean);
    const excluded = [...new Set(exclude)].map(d => this.#pattern(d)).filter(Boolean);

    // per-tab rules are bound to tabIds which content-script matching cannot
    // express; unparsable hosts and oversized lists also fall back to all-urls,
    // otherwise some spoofed pages would run without injection (out of sync)
    const forcedAll = perTab > 0 ||
      (!all && uniq.length !== 0 && patterns.length !== uniq.length) ||
      patterns.length > 50;

    if (!all && !forcedAll && patterns.length === 0) {
      console.info('[injection] content scripts', 'disabled');
      return;
    }

    const props = {
      'allFrames': true,
      'matchOriginAsFallback': true,
      'runAt': 'document_start'
    };
    if (all || forcedAll) {
      props.matches = ['*://*/*'];
      if (all && excluded.length && perTab === 0) {
        props.excludeMatches = excluded;
      }
    }
    else {
      props.matches = patterns;
    }

    console.info('[injection] content scripts', {
      perTab,
      forcedAll: forcedAll && !all,
      props
    });

    try {
      await this.#register(props);
    }
    catch (e) {
      // the API validates inputs only at call-time and rejects the whole
      // batch; wipe any partial registration before recovering
      console.error('[injection] registration failed', props, e);
      await chrome.scripting.unregisterContentScripts().catch(() => {});

      // extra patterns or exclusions might be what got rejected; retry with
      // plain all-urls scope (over-injection is harmless, under-injection is
      // not: spoofed pages must never run without the scripts)
      const safe = {...props, 'matches': ['*://*/*']};
      delete safe.excludeMatches;
      try {
        await this.#register(safe);
        console.warn('[injection] recovered using all-urls scope', safe);
      }
      catch (err) {
        console.error('[injection] unusable; injection is disabled', err);
      }
    }
  }
}
