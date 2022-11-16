const port = document.createElement('span');
port.id = 'ua-port-fgTd9n';
document.documentElement.append(port);

// preferences
self.prefs = self.prefs || {
  ua: 'Mozilla/5.0 (Windows NT 6.3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
  uad: true,
  major: 100,
  name: 'Google Chrome',
  mobile: false,
  platform: 'Windows',
  architecture: 'x86',
  bitness: '64',
  platformVersion: '10.0.0'
};
Object.assign(port.dataset, self.prefs);

port.dataset.enabled = self.ingored ? false : true;
