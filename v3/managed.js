// update prefs.ua from the managed storage or an external server
{
  const configure = j => chrome.storage.local.get({
    'json-guid': 'na'
  }, prefs => {
    if (prefs['json-guid'] !== j['json-guid'] || j['json-forced']) {
      chrome.storage.local.set(j);
      console.info('preferences are updated by an admin');
    }
    console.log(prefs['json-guid'], j['json-guid'], j);
  });

  const run = () => {
    chrome.storage.managed.get({
      'json': ''
    }, rps => {
      if (!chrome.runtime.lastError) {
        if (rps.json) {
          try {
            const j = JSON.parse(rps.json);
            configure(j);
          }
          catch (e) {
            console.error('MANAGED_JSON_PARSE_ERROR', e);
          }
        }
      }
    });

    chrome.storage.local.get({
      'remote-address': ''
    }, prefs => {
      if (prefs['remote-address']) {
        fetch(prefs['remote-address']).then(r => r.json()).then(configure).catch(e => {
          console.error('REMOTE_JSON_PARSE_ERROR', e);
        });
      }
    });
  };

  chrome.storage.onChanged.addListener((ps, type) => {
    if (type === 'managed' && ps.json) {
      run();
    }
    if (type === 'local' && ps['remote-address']) {
      run();
    }
  });
  chrome.runtime.onInstalled.addListener(run);
  chrome.runtime.onStartup.addListener(run);
}
