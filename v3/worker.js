/* global Network */

self.importScripts('context.js');
self.importScripts('/external/ua-parser.min.js', 'agent.js', 'network.js');
self.importScripts('managed.js');

const network = new Network();

chrome.storage.onChanged.addListener((ps, type) => {
  if (
    ps.mode || ps.ua || ps.blacklist || ps.whitelist || ps.custom || ps.sibilings || ps.protected || ps.userAgentData ||
    type === 'session'
  ) {
    network.configure();
  }
});
chrome.runtime.onStartup.addListener(() => network.configure());
chrome.runtime.onInstalled.addListener(() => network.configure());

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'get-port-string') {
    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id
      },
      func: () => self.port.dataset.disabled === 'true' ? '' : (self.port.dataset.str || '')
    }).then(r => response(r[0].result));
    return true;
  }
  else if (request.method === 'no-tab-spoofing') {
    chrome.action.setIcon({
      tabId: sender.tab.id,
      path: {
        '16': '/data/icons/ignored/16.png',
        '32': '/data/icons/ignored/32.png',
        '48': '/data/icons/ignored/48.png'
      }
    });
  }
  else if (request.method === 'tab-spoofing') {
    let dir = 'active';
    if (request.type === 'per-tab' || request.type === 'custom') {
      dir = request.type;
    }

    chrome.action.setIcon({
      tabId: sender.tab.id,
      path: {
        '16': '/data/icons/' + dir + '/16.png',
        '32': '/data/icons/' + dir + '/32.png',
        '48': '/data/icons/' + dir + '/48.png'
      }
    });
    const o = JSON.parse(decodeURIComponent(request.str));
    chrome.action.setTitle({
      tabId: sender.tab.id,
      title: '[' + request.type + '] ' + o.userAgent
    });
  }
  else {
    if (request.method !== 'update-from-remote') {
      console.error('UNKOWN_COMMAND', request);
    }
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
