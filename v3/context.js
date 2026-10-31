const updatePageContextMenus = async () => {
  const {pageContextMenus = false} =
    await chrome.storage.local.get({
      pageContextMenus: false
    });

  await chrome.contextMenus.remove('pause-tab-page').catch(() => {});
  await chrome.contextMenus.remove('resume-tab-page').catch(() => {});

  if (!pageContextMenus) {
    return;
  }

  chrome.contextMenus.create({
    id: 'pause-tab-page',
    title: 'Pause on This Tab',
    contexts: ['page']
  }, () => chrome.runtime.lastError);

  chrome.contextMenus.create({
    id: 'resume-tab-page',
    title: 'Resume on This Tab',
    contexts: ['page']
  }, () => chrome.runtime.lastError);
};

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
  await updatePageContextMenus();
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // page-context-menu items ('pause-tab-page', 'resume-tab-page')
  // reuse the behavior of the action items ('pause-tab', 'resume-tab')
  const id = info.menuItemId.replace('-page', '');
  if (id === 'blacklist' || id === 'whitelist' || id === 'custom') {
    chrome.storage.local.set({
      mode: info.menuItemId
    });
  }
  else if (id === 'pause-tab') {
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
  else if (id === 'resume-tab') {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tab.id]
    });
  }
});

chrome.runtime.onInstalled.addListener(context);
chrome.runtime.onStartup.addListener(context);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pageContextMenus) {
    updatePageContextMenus();
  }
});
