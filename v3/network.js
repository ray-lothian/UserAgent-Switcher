/* global Agent */
/*
  1: main set header rule (blacklist and whitelist) (priority = 1)
  2: main set header rule (blacklist mode only) (priority = 1)
  3: main set JSON rule (priority = 1) or (priority = 2)
  100-119: exception rule (priority = 2)
  200-290: custom rules (priority = 2)
  300-320: protected rules (priority = 1)
  400-499: per-tab rules (session) (priority = 3)
*/

// eslint-disable-next-line no-unused-vars
class Network {
  #EXCEPTION_INDEX = 100;
  #CUSTOM_INDEX = 200;
  #MAX_CUSTOM_RULES = 90;
  #PROTECTED_INDEX = 300;
  #MAX_PROTECTED_RULES = 20;
  #PERTAB_INDEX = 400;
  #MAX_PERTAB_RULES = 98;

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
        'gitlab.com/users/sign_in'
      ]
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
  async dnet(prefs) {
    const addRules = [];
    const resourceTypes = Object.values(chrome.declarativeNetRequest.ResourceType);

    const o = this.agent.parse(prefs.ua);
    o.type = 'user';
    const data = encodeURIComponent(JSON.stringify(o));

    if (prefs.ua && prefs.mode === 'blacklist') {
      const one = {
        'id': 1,
        'priority': 1,
        'action': {
          'type': 'modifyHeaders',
          'requestHeaders': [{
            'header': 'user-agent',
            'operation': 'set',
            'value': o.userAgent
          }]
        },
        'condition': {
          resourceTypes
        }
      };
      const three = {
        'id': 3,
        'priority': 1,
        'action': {
          'type': 'modifyHeaders',
          'responseHeaders': [{
            'header': 'set-cookie',
            'operation': 'append',
            'value': `uasw-json-data=${data}`
          }]
        },
        'condition': {
          'resourceTypes': ['main_frame', 'sub_frame']
        }
      };
      addRules.push(one, three);
      if (prefs.blacklist.length) {
        addRules.push({
          'id': this.#EXCEPTION_INDEX,
          'priority': 2,
          'action': {
            'type': 'allowAllRequests'
          },
          'condition': {
            'resourceTypes': ['main_frame', 'sub_frame'],
            'requestDomains': prefs.blacklist
          }
        });
      }
    }
    else if (prefs.ua && prefs.mode === 'whitelist' && prefs.whitelist.length) {
      const one = {
        'id': 1,
        'priority': 1,
        'action': {
          'type': 'modifyHeaders',
          'requestHeaders': [{
            'header': 'user-agent',
            'operation': 'set',
            'value': o.userAgent
          }]
        },
        'condition': {
          'initiatorDomains': prefs.whitelist,
          'resourceTypes': resourceTypes.filter(s => s !== 'main_frame' && s !== 'sub_frame')
        }
      };
      const two = {
        'id': 2,
        'priority': 1,
        'action': {
          'type': 'modifyHeaders',
          'requestHeaders': [{
            'header': 'user-agent',
            'operation': 'set',
            'value': o.userAgent
          }]
        },
        'condition': {
          'requestDomains': prefs.whitelist,
          'resourceTypes': ['main_frame', 'sub_frame']
        }
      };
      const three = {
        'id': 3,
        'priority': 1,
        'action': {
          'type': 'modifyHeaders',
          'responseHeaders': [{
            'header': 'set-cookie',
            'operation': 'append',
            'value': `uasw-json-data=${data}`
          }]
        },
        'condition': {
          'requestDomains': prefs.whitelist,
          'resourceTypes': ['main_frame', 'sub_frame']
        }
      };

      addRules.push(one, two, three);
    }
    else if (prefs.mode === 'custom') {
      if (prefs.custom['*'] || prefs.ua) {
        const ua = Array.isArray(prefs.custom['*']) ?
          prefs.custom['*'][Math.floor(Math.random() * prefs.custom['*'].length)] :
          (prefs.custom['*'] || prefs.ua);

        const o = this.agent.parse(ua);
        o.type = prefs.custom['*'] ? '*' : 'user';
        const data = encodeURIComponent(JSON.stringify(o));

        const one = {
          'id': 1,
          'priority': 1,
          'action': {
            'type': 'modifyHeaders',
            'requestHeaders': [{
              'header': 'user-agent',
              'operation': 'set',
              'value': o.userAgent
            }]
          },
          'condition': {
            resourceTypes
          }
        };

        const three = {
          'id': 3,
          'priority': 2, // for custom ones to be called after
          'action': {
            'type': 'modifyHeaders',
            'responseHeaders': [{
              'header': 'set-cookie',
              'operation': 'append',
              'value': `uasw-json-data=${data}`
            }]
          },
          'condition': {
            'resourceTypes': ['main_frame', 'sub_frame']
          }
        };

        addRules.push(one, three);
      }
      let n = this.#CUSTOM_INDEX;
      for (const [hosts, value] of Object.entries(prefs.custom)) {
        if (hosts === '*') {
          continue;
        }
        if (hosts === '_') {
          console.info('"_" rule is deprecated. All random user-agent strings are persistent for browser session');
          continue;
        }

        const ua = Array.isArray(value) ? value[Math.floor(Math.random() * value.length)] : value;
        const o = this.agent.parse(ua);
        o.type = 'custom';
        const data = encodeURIComponent(JSON.stringify(o));
        const domains = hosts.split(/\s*,\s*/);

        const one = {
          'id': n,
          'priority': 2,
          'action': {
            'type': 'modifyHeaders',
            'requestHeaders': [{
              'header': 'user-agent',
              'operation': 'set',
              'value': o.userAgent
            }]
          },
          'condition': {
            'initiatorDomains': domains,
            'resourceTypes': resourceTypes.filter(s => s !== 'main_frame' && s !== 'sub_frame')
          }
        };
        const two = {
          'id': n + 1,
          'priority': 2,
          'action': {
            'type': 'modifyHeaders',
            'requestHeaders': [{
              'header': 'user-agent',
              'operation': 'set',
              'value': o.userAgent
            }]
          },
          'condition': {
            'requestDomains': domains,
            'resourceTypes': ['main_frame', 'sub_frame']
          }
        };
        const three = {
          'id': n + 2,
          'priority': 1, // to be called later
          'action': {
            'type': 'modifyHeaders',
            'responseHeaders': [{
              'header': 'set-cookie',
              'operation': 'append',
              'value': `uasw-json-data=${data}`
            }]
          },
          'condition': {
            'requestDomains': domains,
            'resourceTypes': ['main_frame', 'sub_frame']
          }
        };
        addRules.push(one, two, three);

        n += 3;

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
            'priority': 2,
            'action': {
              'type': 'allow'
            },
            'condition': {
              regexFilter,
              resourceTypes
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
      const data = encodeURIComponent(JSON.stringify(o));

      const one = {
        'id': m,
        'priority': 3,
        'action': {
          'type': 'modifyHeaders',
          'requestHeaders': [{
            'header': 'user-agent',
            'operation': 'set',
            'value': o.userAgent
          }]
        },
        'condition': {
          'tabIds': key.split(',').map(Number),
          'resourceTypes': Object.values(chrome.declarativeNetRequest.ResourceType)
        }
      };
      const two = {
        'id': m + 1,
        'priority': 1, // to override the global set-cookie with priority 2
        'action': {
          'type': 'modifyHeaders',
          'responseHeaders': [{
            'header': 'set-cookie',
            'operation': 'append',
            'value': `uasw-json-data=${data}`
          }]
        },
        'condition': {
          'tabIds': key.split(',').map(Number),
          'resourceTypes': ['main_frame', 'sub_frame']
        }
      };

      addRules.push(one, two);

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
    /*

    "content_scripts": [{
      "matches": ["<all_urls>"],
      "js": ["/data/inject/main.js", "/data/inject/override.js"],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true,
      "match_origin_as_fallback": true,
      "world": "MAIN"
    }, {
      "matches": ["<all_urls>"],
      "js": ["/data/inject/isolated.js"],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true,
      "match_origin_as_fallback": true,
      "world": "ISOLATED"
    }]

    */
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
