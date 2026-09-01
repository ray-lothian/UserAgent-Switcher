// update preferences from the managed storage or an external server
{
  const configure = j => chrome.storage.local.get({
    'json-guid': 'na',
    'remote-address': ''
  }, prefs => {
    if (prefs['json-guid'] !== j['json-guid'] || j['json-forced']) {
      if (j['json-guid']) {
        if ('remote-address' in j) {
          // Prevent Firefox from looping when managed storage set all preferences
          if (prefs['remote-address'] === j['remote-address']) {
            delete j['remote-address'];
          }
        }

        chrome.storage.local.set(j);
        console.info('preferences are updated by an admin');
      }
      else {
        console.info('update from server is rejected: no "json-guid" key.');
      }
    }
    else if (prefs['json-guid'] === j['json-guid']) {
      console.info('update from server is rejected: up-to-date');
    }
  });

  const run = () => {
    chrome.storage.managed.get(null, rps => {
      rps = rps || {};

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
        else {
          delete rps.json;
          // to support direct configuration without providing JSON
          if (Object.keys(rps).length) {
            configure(rps);
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
    if (type === 'managed') {
      if (ps.json || ps.ua) {
        run();
      }
    }
    if (type === 'local' && ps['remote-address']) {
      run();
    }
  });
  chrome.runtime.onInstalled.addListener(run);
  chrome.runtime.onStartup.addListener(run);

  chrome.runtime.onMessage.addListener((request, sender, response) => {
    if (request.method === 'update-from-remote') {
      fetch(request.href).then(r => r.json()).then(configure)
        .then(() => response(true)).catch(e => response(e.message));

      return true;
    }
  });
}
