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

  async configure() {
    this.agent = new Agent();
    const dps = await this.agent.prefs();

    this.#scope = {all: false, include: [], exclude: []};
    try {
      await this.dnet(dps);
    }
    catch (e) {
      // updateDynamicRules is atomic; stale dynamic rules might still be active
      console.error('[network] dynamic rules failed', e);
    }

    let perTab = 0;
    try {
      const sps = await chrome.storage.session.get(null);
      perTab = await this.snet(sps);
    }
    catch (e) {
      // commit failed atomically -> old per-tab rules may still be active;
      // keep global injection so those tabs never run without it
      perTab = 1;
      console.error('[network] session rules failed', e);
    }

    await this.page(perTab);
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
        let platform = o.userAgentDataBuilder.p?.os?.name || 'Windows';
        if (platform.toLowerCase().includes('mac')) {
          platform = 'macOS';
        }
        else if (platform.toLowerCase().includes('debian')) {
          platform = 'Linux';
        }

        const version = o.userAgentDataBuilder.p?.browser?.major || 107;
        let name = o.userAgentDataBuilder.p?.browser?.name || 'Google Chrome';
        if (name === 'Chrome') {
          name = 'Google Chrome';
        }

        if (!this.#ISFARARI) {
          r.requestHeaders.push({
            'header': 'sec-ch-ua-platform',
            'operation': 'set',
            'value': '"' + platform + '"'
          }, {
            'header': 'sec-ch-ua',
            'operation': 'set',
            'value': `"Not/A)Brand";v="8", "Chromium";v="${version}", "${name}";v="${version}"`
          }, {
            'header': 'sec-ch-ua-mobile',
            'operation': 'set',
            'value': /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(o.userAgent) ? '?1' : '?0'
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
  async dnet(prefs) {
    const addRules = [];

    const o = this.agent.parse(prefs.ua);
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
        'condition': {
          'resourceTypes': ['main_frame', 'sub_frame']
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
          'condition': {
            'requestDomains': whitelist,
            'resourceTypes': ['main_frame', 'sub_frame']
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

        const o = this.agent.parse(ua);
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
          'condition': {
            'resourceTypes': ['main_frame', 'sub_frame']
          }
        });
      }
      let n = this.#CUSTOM_INDEX;
      for (const [hosts, value] of Object.entries(prefs.custom)) {
        if (hosts === '*' || hosts === '_') {
          continue;
        }

        const ua = Array.isArray(value) ? value[Math.floor(Math.random() * value.length)] : value;
        const o = this.agent.parse(ua);
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
          'condition': {
            'requestDomains': domains,
            'resourceTypes': ['main_frame', 'sub_frame']
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

    console.info('[network] dynamic rules', {
      mode: prefs.mode,
      rules: addRules,
      scope: {...this.#scope}
    });

    return addRules.length;
  }
  async snet(prefs) {
    // per-tab rules
    const addRules = [];

    let m = this.#PERTAB_INDEX;
    for (const [key, {ua}] of Object.entries(prefs)) {
      if (!ua) {
        continue;
      }
      const o = this.agent.parse(ua);
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

    console.info('[network] per-tab session rules', {
      rules: addRules,
      tabs: addRules.filter(r => r.condition.tabIds).flatMap(r => r.condition.tabIds)
    });

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
      console.info('[injection] disabled', {
        reason: 'no active network rules'
      });
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
