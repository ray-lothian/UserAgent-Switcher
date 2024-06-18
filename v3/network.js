/* global Agent */
/*
  1: main set header rule (blacklist and whitelist)
  2: main set header rule (blacklist mode only)
  3: main set JSON rule
  100-119: protected rules
  200-219: exceptions
*/
class Network {
  #EXCEPTION_INDEX = 100;
  #CUSTOM_INDEX = 200;
  #MAX_CUSTOM_RULES = 90;
  #PROTECTED_INDEX = 300;
  #MAX_PROTECTED_RULES = 20;

  configure() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get({
        'mode': 'blacklist',
        'ua': '',
        'blacklist': [],
        'whitelist': [],
        'custom': {},
        'protected': [
          'google.com/recaptcha',
          'gstatic.com/recaptcha',
          'accounts.google.com',
          'accounts.youtube.com',
          'gitlab.com/users/sign_in'
        ]
      }, prefs => {
        // configure network and content script
        this.net(prefs).then(size => {
          chrome.action.setIcon({
            path: {
              '16': 'data/icons/' + (size ? 'active' : '') + '/16.png',
              '32': 'data/icons/' + (size ? 'active' : '') + '/32.png',
              '48': 'data/icons/' + (size ? 'active' : '') + '/48.png'
            }
          });

          return this.page(size);
        }).then(resolve, reject);
      });
    });
  }
  async net(prefs) {
    const addRules = [];
    const resourceTypes = Object.values(chrome.declarativeNetRequest.ResourceType);

    const agent = new Agent();
    agent.prefs({
      parser: {}
    });
    const o = agent.parse(prefs.ua);
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
            'value': prefs.ua
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
            'value': prefs.ua
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
            'value': prefs.ua
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

        const one = {
          'id': 1,
          'priority': 1,
          'action': {
            'type': 'modifyHeaders',
            'requestHeaders': [{
              'header': 'user-agent',
              'operation': 'set',
              'value': ua
            }]
          },
          'condition': {
            resourceTypes
          }
        };

        const o = agent.parse(ua);
        const data = encodeURIComponent(JSON.stringify(o));
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
        const o = agent.parse(ua);
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
              'value': ua
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
              'value': ua
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
            console.error('protected rule is ignored', c, v.reason);
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
    return chrome.declarativeNetRequest.updateDynamicRules({
      addRules,
      removeRuleIds
    }).then(() => addRules.length);
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

//chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(d => console.log(d));
