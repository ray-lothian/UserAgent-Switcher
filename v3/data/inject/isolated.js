/* global cloneInto */

// console.log('isolated.js');
let port = self.port = document.getElementById('uas-port');

const id = (Math.random() + 1).toString(36).substring(7);

const override = reason => {
  const detail = typeof cloneInto === 'undefined' ? {id, reason} : cloneInto({id, reason}, self);
  port.dispatchEvent(new CustomEvent('override', {
    detail
  }));

  if (self.top === top) {
    if (port.dataset.str) {
      chrome.runtime.sendMessage({
        method: 'tab-spoofing',
        str: port.dataset.str,
        type: port.dataset.type
      });
    }
  }
};

if (port) {
  port.dataset.id = id;
  port.remove();
}
else { // iframe[sandbox]
  try {
    const hierarchy = [];
    let [p, s] = [parent, self];
    for (;;) {
      for (let n = 0; n < p.frames.length; n += 1) {
        if (p.frames[n] === s) {
          hierarchy.unshift(n);
        }
      }
      console.log(p);
      if (p.port) {
        port = p.port;
        console.log(port);
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
  // cross-origin sandboxed iframe
  catch (e) {
    console.info('[user-agent leaked]', e, location.href);
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
            if ('str' in p.port.dataset) {
              port.dataset.str = p.port.dataset.str;
              override('parent');
            }
          }
          break;
        }
        [s, p] = [p, p.parent];

        if (s === p) {
          break;
        }
      }
      // Firefox -> iframe[about:blank]
      if (!port.dataset.str) {
        throw Error('UA_SET_FAILED');
      }
    }
    catch (e) { // cross-origin frame or when top-level is from service worker
      console.info('[user-agent leaked]', 'using async method', location.href, port.dataset.cached);

      chrome.runtime.sendMessage({
        method: 'get-port-string',
        cached: port.dataset.cached === 'true',
        top: self.top === self
      }, str => {
        if (str) {
          port.dataset.str = str;
          override('async');
        }
      });
    }
  }
}
