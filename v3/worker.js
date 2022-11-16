/* global policy, scripting, request */

self.importScripts('./policy.js');
self.importScripts('./scripting.js');
self.importScripts('./request.js');

// run on each wake up
policy.configure(scripting.commit, request.network);

// run once
{
  const once = () => policy.configure(scripting.page);

  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}

chrome.storage.onChanged.addListener(ps => {
  if (ps.enabled || ps.mode || ps['blacklist-exception-hosts'] || ps['whitelist-hosts']) {
    policy.configure(scripting.commit, scripting.page, request.network);
  }
});
