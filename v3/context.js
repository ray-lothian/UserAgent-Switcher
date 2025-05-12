const context = async () => {
  if (context.ran) {
    return;
  }
  context.ran = true;

  // we do not support custom mode on m3 anymore
  chrome.contextMenus.create({
    id: 'blacklist',
    title: 'Switch to "black-list" mode',
    contexts: ['action'],
    type: 'radio'
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    id: 'whitelist',
    title: 'Switch to "white-list" mode',
    contexts: ['action'],
    type: 'radio'
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    id: 'custom',
    title: 'Switch to "custom" mode',
    contexts: ['action'],
    type: 'radio'
  }, () => chrome.runtime.lastError);

  chrome.contextMenus.create({
    id: 'pause-tab',
    title: 'Pause on This Tab',
    contexts: ['action']
  }, () => chrome.runtime.lastError);
  chrome.contextMenus.create({
    id: 'resume-tab',
    title: 'Resume on This Tab',
    contexts: ['action']
  }, () => chrome.runtime.lastError);

  const prefs = await chrome.storage.local.get({
    'mode': 'blacklist'
  });
  chrome.contextMenus.update(prefs.mode, {
    checked: true
  });
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'blacklist' || info.menuItemId === 'whitelist' || info.menuItemId === 'custom') {
    chrome.storage.local.set({
      mode: info.menuItemId
    });
  }
  else if (info.menuItemId === 'pause-tab') {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tab.id],
      addRules: [{
        id: tab.id,
        action: {
          type: 'allowAllRequests'
        },
        priority: 3,
        condition: {
          tabIds: [tab.id],
          resourceTypes: ['main_frame', 'sub_frame']
        }
      }]
    });
  }
  else if (info.menuItemId === 'resume-tab') {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tab.id]
    });
  }
});

chrome.runtime.onInstalled.addListener(context);
chrome.runtime.onStartup.addListener(context);
