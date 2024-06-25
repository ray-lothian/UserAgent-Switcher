{
  const override = (nav, reason) => {
    if (port.dataset.ready !== true) {
      port.prepare();
    }

    try {
      if (port.prefs.userAgentDataBuilder) {
        const v = new class NavigatorUAData {
          #p;

          constructor({p, ua}) {
            this.#p = p;

            const version = p.browser.major;
            const name = p.browser.name === 'Chrome' ? 'Google Chrome' : p.browser.name;

            this.brands = [{
              brand: 'Not/A)Brand',
              version: '8'
            }, {
              brand: 'Chromium',
              version
            }, {
              brand: name,
              version
            }];

            this.mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

            // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-CH-UA-Platform
            this.platform = 'Unknown';
            if (p.os && p.os.name) {
              const name = p.os.name.toLowerCase();
              if (name.includes('mac')) {
                this.platform = 'macOS';
              }
              else if (name.includes('debian')) {
                this.platform = 'Linux';
              }
              else {
                this.platform = p.os.name;
              }
            }
          }
          toJSON() {
            return {
              brands: this.brands,
              mobile: this.mobile,
              platform: this.platform
            };
          }
          getHighEntropyValues(hints) {
            if (!hints || Array.isArray(hints) === false) {
              return Promise.reject(Error(`Failed to execute 'getHighEntropyValues' on 'NavigatorUAData'`));
            }

            const r = this.toJSON();

            if (hints.includes('architecture')) {
              r.architecture = this.#p?.cpu?.architecture || 'x86';
            }
            if (hints.includes('bitness')) {
              r.bitness = '64';
            }
            if (hints.includes('model')) {
              r.model = '';
            }
            if (hints.includes('platformVersion')) {
              r.platformVersion = this.#p?.os?.version || '10.0.0';
            }
            if (hints.includes('uaFullVersion')) {
              r.uaFullVersion = this.brands[0].version;
            }
            if (hints.includes('fullVersionList')) {
              r.fullVersionList = this.brands;
            }
            return Promise.resolve(r);
          }
        }(port.prefs.userAgentDataBuilder);

        nav.__defineGetter__('userAgentData', () => {
          return v;
        });
      }
      delete port.prefs.userAgentDataBuilder;

      for (const key of Object.keys(port.prefs)) {
        if (key === 'type') {
          continue;
        }
        if (port.prefs[key] === '[delete]') {
          delete Object.getPrototypeOf(nav)[key];
        }
        else {
          nav.__defineGetter__(key, () => {
            if (port.prefs[key] === 'empty') {
              return '';
            }
            return port.prefs[key];
          });
        }
      }
    }
    catch (e) {
      console.error('UA_SET_FAILED', e);
    }
  };

  const port = document.getElementById('uas-port');
  port.addEventListener('override', e => {
    if (e.detail.id === port.dataset.id) {
      override(navigator, e.detail.reason);
    }
    else {
      const nav = port.ogs.get(e.detail.id).navigator;
      override(nav, e.detail.reason);
    }
  });
}
