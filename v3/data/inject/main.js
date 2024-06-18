{
  const port = document.createElement('span');
  port.id = 'uas-port';
  port.prepare = () => {
    port.dataset.ready = true;
    port.prefs = JSON.parse(decodeURIComponent(port.dataset.str));
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
  const ck = document.cookie.split('uasw-json-data=');
  if (ck.length > 1) {
    document.cookie = `uasw-json-data=; expires=Thu, 01 Jan 1970 00:00:00 UTC`;

    port.dataset.str = ck[1].split(';')[0];
    port.prepare();
  }
  else {
    // extension is not active for this tab
    if (self.top === self) {
      port.dataset.disabled = true;
    }
  }
}
