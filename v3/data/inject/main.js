{
  const port = document.createElement('span');
  port.id = 'uas-port';
  port.prepare = () => {
    port.prefs = JSON.parse(decodeURIComponent(port.dataset.str));
    port.dataset.ready = true;
    port.dataset.type = port.prefs.type;
  };
  port.ogs = new Map();
  port.addEventListener('register', e => {
    const win = e.detail.hierarchy.reduce((p, c) => {
      return p.frames[c];
    }, parent);
    port.ogs.set(e.detail.id, win);
  });

  document.documentElement.append(port);
  // find user-agent data
  for (const entry of performance.getEntriesByType('navigation')) {
    for (const timing of entry.serverTiming || []) {
      if (timing.name === 'uasw-json-data') {
        port.dataset.str = timing.description;
      }
    }
  }

  if (port.dataset.str) {
    port.prepare();
  }
  else {
    // extension is not active for this tab
    if (self.top === self) {
      port.dataset.disabled = true;
    }
  }
}
