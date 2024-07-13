/* global Agent */

// eslint-disable-next-line no-unused-vars
class Network {
  #CUSTOM_INDEX = 1000;
  #MAX_CUSTOM_RULES = 200;
  #PROTECTED_INDEX = 2000;
  #MAX_PROTECTED_RULES = 50;
  #PERTAB_INDEX = 3000;
  #MAX_PERTAB_RULES = 200;

  #RESOURCETYPE = Object.values(chrome.declarativeNetRequest.ResourceType);

  async configure() {
    let size = 0;
    const dps = await new Promise(resolve => chrome.storage.local.get({
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
        'gitlab.com/users/sign_in',
        'challenges.cloudflare.com'
      ],
      'userAgentData': true
    }, resolve));

    this.agent = new Agent();
    this.agent.prefs(dps);

    size += await this.dnet(dps);

    const sps = await new Promise(resolve => chrome.storage.session.get(null, resolve));
    size += await this.snet(sps);

    chrome.action.setIcon({
      path: {
        '16': 'data/icons/' + (size ? 'active' : '') + '/16.png',
        '32': 'data/icons/' + (size ? 'active' : '') + '/32.png',
        '48': 'data/icons/' + (size ? 'active' : '') + '/48.png'
      }
    });
    await this.page(size);
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
      const chrs = [
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
        'operation': 'append',
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
      addRules.push({
        'id': 1,
        'priority': 1,
        'action': this.action(o, 'net'),
        'condition': {
          'resourceTypes': this.#RESOURCETYPE,
          'excludedRequestDomains': prefs.blacklist
        }
      }, {
        'id': 2,
        'priority': 3,
        'action': this.action(o, 'js'),
        'condition': {
          'resourceTypes': ['main_frame', 'sub_frame'],
          'excludedRequestDomains': prefs.blacklist
        }
      });
    }
    else if (prefs.ua && prefs.mode === 'whitelist' && prefs.whitelist.length) {
      addRules.push({
        'id': 1,
        'priority': 1,
        'action': this.action(o, 'net'),
        'condition': {
          'initiatorDomains': prefs.whitelist,
          'excludedResourceTypes': ['main_frame', 'sub_frame']
        }
      }, {
        'id': 2,
        'priority': 1,
        'action': this.action(o, 'net'),
        'condition': {
          'requestDomains': prefs.whitelist,
          'resourceTypes': ['main_frame', 'sub_frame']
        }
      }, {
        'id': 3,
        'priority': 3,
        'action': this.action(o, 'net', 'js'),
        'condition': {
          'requestDomains': prefs.whitelist,
          'resourceTypes': ['main_frame', 'sub_frame']
        }
      });
    }
    else if (prefs.mode === 'custom') {
      if (prefs.custom['*'] || prefs.ua) {
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
          'priority': 3, // for custom ones to be called after
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

        const domains = hosts.split(/\s*,\s*/);

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

    if ((prefs.mode === 'blacklist' || prefs.mode === 'custom') && addRules.length) {
      if (prefs.protected.length) {
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
    }

    const removeRuleIds = await chrome.declarativeNetRequest.getDynamicRules().then(arr => arr.map(o => o.id));
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules,
      removeRuleIds
    }).then(() => addRules.length);

    return addRules.length;
  }
  async snet(prefs) {
    // per-tab rules
    const addRules = [];

    let m = this.#PERTAB_INDEX;
    for (const [key, {ua}] of Object.entries(prefs)) {
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
        'priority': 1, // to override the global set-cookie with priority 2
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

    return addRules.length;
  }
  async page(size) {
    await chrome.scripting.unregisterContentScripts();

    if (size) {
      const props = {
        'matches': ['*://*/*'],
        'allFrames': true,
        'matchOriginAsFallback': true,
        'runAt': 'document_start'
      };
      // since order is important, do not register simultaneously
      await chrome.scripting.registerContentScripts([{
        'id': 'main',
        'js': ['/data/inject/main.js'],
        'world': 'MAIN',
        ...props
      }]);
      await chrome.scripting.registerContentScripts([{
        'id': 'override',
        'js': ['/data/inject/override.js'],
        'world': 'MAIN',
        ...props
      }]);
      await chrome.scripting.registerContentScripts([{
        'id': 'isolated',
        'js': ['/data/inject/isolated.js'],
        'world': 'ISOLATED',
        ...props
      }]);
    }
  }
}
