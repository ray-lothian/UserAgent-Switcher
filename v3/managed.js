// update prefs.ua from the managed storage
{
  const run = () => chrome.storage.local.get({
    'json-guid': 'na'
  }, prefs => {
    try {
      chrome.storage.managed.get({
        'ua': '',
        'json': ''
      }, rps => {
        if (!chrome.runtime.lastError) {
          if (rps.json) {
            try {
              const j = JSON.parse(rps.json);
              if (prefs['json-guid'] !== j['json-guid'] || j['json-forced']) {
                chrome.storage.local.set(j);
                console.info('preferences are updated by an admin');
              }
            }
            catch (e) {
              console.error('REMOTE_JSON_PARSE_ERROR', e);
            }
          }
        }
      });
    }
    catch (e) {
      console.error('REMOTE_JSON_UPDATE', e);
    }
  });
  chrome.runtime.onInstalled.addListener(run);
  chrome.runtime.onStartup.addListener(run);
}
