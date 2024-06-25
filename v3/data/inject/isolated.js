let port = self.port = document.getElementById('uas-port');

const id = (Math.random() + 1).toString(36).substring(7);

const override = reason => {
  port.dispatchEvent(new CustomEvent('override', {
    detail: {
      id,
      reason
    }
  }));
};

if (port) {
  port.dataset.id = id;
  port.remove();

  if (self.top === self) {
    if (port.dataset.disabled === 'true') {
      chrome.runtime.sendMessage({
        method: 'no-tab-spoofing'
      });
    }
    else {
      chrome.runtime.sendMessage({
        method: 'tab-spoofing',
        str: port.dataset.str,
        type: port.dataset.type
      });
    }
  }
}
else { // iframe[sandbox]
  const hierarchy = [];
  let [p, s] = [parent, self];
  for (;;) {
    for (let n = 0; n < p.frames.length; n += 1) {
      if (p.frames[n] === s) {
        hierarchy.unshift(n);
      }
    }
    if (p.port) {
      port = p.port;
      if (port.dataset.disabled !== 'true') {
        port.dispatchEvent(new CustomEvent('register', {
          detail: {
            id,
            hierarchy
          }
        }));
      }
      break;
    }
    [s, p] = [p, p.parent];

    if (s === p) {
      break;
    }
  }
}

if (port) {
  if (port.dataset.str) {
    if (port.dataset.disabled !== 'true') {
      override('normal');
    }
  }
  // sub-frames and cross-origin frames
  else {
    try {
      let [p, s] = [parent, self];
      for (;;) {
        if (p.port) {
          if (p.port.dataset.disabled === 'true') {
            port.dataset.disabled = true;
          }
          else {
            port.dataset.str = p.port.dataset.str;
            override('parent');
          }
          break;
        }
        [s, p] = [p, p.parent];

        if (s === p) {
          break;
        }
      }
    }
    catch (e) { // cross-origin frame
      chrome.runtime.sendMessage({
        method: 'get-port-string'
      }, str => {
        if (str) {
          port.dataset.str = str;
          override('async');
        }
      });
    }
  }
}
