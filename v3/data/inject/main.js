// console.log('main.js', location.href);

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

  // XML document -> https://www.w3schools.com/xml/note.xml
  if (port.dataset) {
    // find user-agent data
    for (const entry of performance.getEntriesByType('navigation')) {
      for (const timing of entry.serverTiming || []) {
        if (timing.name === 'uasw-json-data') {
          port.dataset.str = timing.description;
        }
      }
    }

    // the payload rode the Server-Timing header of this document's response,
    // which any script can read back through the performance timeline; strip
    // our marker from every observable surface (issue #270). Installed after
    // the extraction above, which is the last read that needs the raw value
    {
      const MARKER = 'uasw-json-data';
      try {
        // serverTiming is specified on the subclass prototypes (navigation/
        // resource timings), not on the shared PerformanceEntry interface;
        // patching the wrong table is a silent no-op
        for (const ctor of [PerformanceNavigationTiming, PerformanceResourceTiming]) {
          const d = Object.getOwnPropertyDescriptor(ctor.prototype, 'serverTiming');
          if (d && d.get) {
            // native serverTiming is a [SameObject] FrozenArray; repeated
            // reads must hand out one stable (filtered) array per entry
            const filtered = new WeakMap();
            const props = {
              get: function serverTiming() {
                let out = filtered.get(this);
                if (out === undefined) {
                  out = Object.freeze(
                    (d.get.call(this) || []).filter(t => t.name !== MARKER)
                  );
                  filtered.set(this, out);
                }
                return out;
              },
              configurable: true,
              enumerable: d.enumerable
            };
            if (d.set) {
              props.set = d.set;
            }
            Object.defineProperty(ctor.prototype, 'serverTiming', props);
          }
          // native toJSON reads internal slots and bypasses the patched
          // getter, so the serializer needs its own wrapper; the method may
          // live on the subclass prototype or on the shared base
          const t = Object.getOwnPropertyDescriptor(ctor.prototype, 'toJSON') ||
            Object.getOwnPropertyDescriptor(PerformanceEntry.prototype, 'toJSON');
          if (t && t.value) {
            Object.defineProperty(ctor.prototype, 'toJSON', {
              value: function toJSON() {
                const j = t.value.call(this);
                if (j && Array.isArray(j.serverTiming)) {
                  j.serverTiming = j.serverTiming.filter(e => e.name !== MARKER);
                }
                return j;
              },
              writable: true,
              configurable: true,
              enumerable: t.enumerable
            });
          }
        }
      }
      catch (e) {}
    }
    // cached
    for (const entry of performance.getEntriesByType('navigation')) {
      if (entry.deliveryType === 'cache-storage') {
        port.dataset.cached = true;
        break;
      }
    }
    if (port.dataset.str) {
      port.prepare();
    }
    else {
      // extension is not active for this tab or top-level request is from service worker
      if (self.top === self) {
        if (port.dataset.cached !== 'true') {
          port.dataset.disabled = true;
        }
      }
    }
  }
  else {
    console.info(
      '[User-Agent Switcher and Manager] Cannot spoof this context: This might be an XML document',
      location.href
    );
  }
}
