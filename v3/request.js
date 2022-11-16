/* global policy */

const request = {};

request.network = async prefs => {
  const p = await policy.parse();

  const condition = {
    'isUrlFilterCaseSensitive': false,
    'resourceTypes': Object.values(chrome.declarativeNetRequest.ResourceType)
  };
  const one = {
    'id': 1,
    'priority': 1,
    'action': {
      'type': 'modifyHeaders',
      'requestHeaders': [{
        'operation': 'set',
        'header': 'user-agent',
        'value': p.ua
      }]
    },
    'condition': {
      ...condition
    }
  };
  const o = {
    addRules: [one],
    removeRuleIds: (await chrome.declarativeNetRequest.getDynamicRules()).map(o => o.id)
  };

  if (prefs.enabled) {
    if (prefs.mode === 'blacklist') {
      one.condition.excludedInitiatorDomains = prefs['blacklist-exception-hosts'];
    }
    else {
      if (prefs['whitelist-hosts'].length) {
        one.condition.initiatorDomains = prefs['whitelist-hosts'];
      }
      else {
        console.info('matching list is empty');
        o.addRules.length = 0;
      }
    }
  }

  chrome.declarativeNetRequest.updateDynamicRules(o);
};

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(d => console.log(d));

