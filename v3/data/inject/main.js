const port = document.getElementById('ua-port-fgTd9n');
port.remove();

// overwrite navigator.userAgent
{
  const {get} = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');

  Object.defineProperty(Navigator.prototype, 'userAgent', {
    get: new Proxy(get, {
      apply(target, self, args) {
        return port.dataset.enabled === 'true' ? port.dataset.ua : Reflect.apply(target, self, args);
      }
    })
  });
}

// overwrite navigator.userAgentData
if (port.dataset.uad) {
  self.NavigatorUAData = self.NavigatorUAData || new class NavigatorUAData {
    brands = [];
    mobile = false;
    platform = 'Unknown';
    toJSON() {
      return {};
    }
    getHighEntropyValues() {
      return Promise.resolve({});
    }
  };

  Object.defineProperty(self.NavigatorUAData.prototype, 'brands', {
    get: new Proxy(Object.getOwnPropertyDescriptor(self.NavigatorUAData.prototype, 'brands').get, {
      apply(target, self, args) {
        return port.dataset.enabled === 'true' ? [{
          brand: port.dataset.name,
          version: port.dataset.major
        }, {
          brand: 'Chromium',
          version: port.dataset.major
        }, {
          brand: 'Not=A?Brand',
          version: '24'
        }] : Reflect.apply(target, self, args);
      }
    })
  });
  Object.defineProperty(self.NavigatorUAData.prototype, 'mobile', {
    get: new Proxy(Object.getOwnPropertyDescriptor(self.NavigatorUAData.prototype, 'mobile').get, {
      apply(target, self, args) {
        return port.dataset.enabled === 'true' ? port.dataset.mobile === 'true' : Reflect.apply(target, self, args);
      }
    })
  });
  Object.defineProperty(self.NavigatorUAData.prototype, 'platform', {
    get: new Proxy(Object.getOwnPropertyDescriptor(self.NavigatorUAData.prototype, 'platform').get, {
      apply(target, self, args) {
        return port.dataset.enabled === 'true' ? port.dataset.platform : Reflect.apply(target, self, args);
      }
    })
  });
  self.NavigatorUAData.prototype.toJSON = new Proxy(self.NavigatorUAData.prototype.toJSON, {
    apply(target, self, args) {
      return port.dataset.enabled === 'true' ? {
        brands: self.brands,
        mobile: self.mobile,
        platform: self.platform
      } : Reflect.apply(target, self, args);
    }
  });
  self.NavigatorUAData.prototype.getHighEntropyValues = new Proxy(self.NavigatorUAData.prototype.getHighEntropyValues, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true') {
        const hints = args[0];

        if (!hints || Array.isArray(hints) === false) {
          return Promise.reject(Error(`Failed to execute 'getHighEntropyValues' on 'NavigatorUAData'`));
        }

        const r = self.toJSON();

        if (hints.includes('architecture')) {
          r.architecture = port.dataset.architecture;
        }
        if (hints.includes('bitness')) {
          r.bitness = port.dataset.bitness;
        }
        if (hints.includes('model')) {
          r.model = '';
        }
        if (hints.includes('platformVersion')) {
          r.platformVersion = port.dataset.platformVersion;
        }
        if (hints.includes('uaFullVersion')) {
          r.uaFullVersion = self.brands[0].version;
        }
        if (hints.includes('fullVersionList')) {
          r.fullVersionList = this.brands;
        }
        return Promise.resolve(r);
      }
      return Reflect.apply(target, self, args);
    }
  });
}
