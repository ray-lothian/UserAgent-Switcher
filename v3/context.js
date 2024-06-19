const context = () => chrome.storage.local.get({
  'mode': 'blacklist'
}, prefs => {
  // we do not support custom mode on m3 anymore
  chrome.contextMenus.create({
    id: 'blacklist',
    title: 'Switch to "black-list" mode',
    contexts: ['action'],
    type: 'radio',
    checked: prefs.mode === 'blacklist'
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    id: 'whitelist',
    title: 'Switch to "white-list" mode',
    contexts: ['action'],
    type: 'radio',
    checked: prefs.mode === 'whitelist'
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    id: 'custom',
    title: 'Switch to "custom" mode',
    contexts: ['action'],
    type: 'radio',
    checked: prefs.mode === 'custom'
  }, () => chrome.runtime.lastError);
});

chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'blacklist' || info.menuItemId === 'whitelist' || info.menuItemId === 'custom') {
    chrome.storage.local.set({
      mode: info.menuItemId
    });
  }
});

chrome.runtime.onInstalled.addListener(context);
chrome.runtime.onStartup.addListener(context);
