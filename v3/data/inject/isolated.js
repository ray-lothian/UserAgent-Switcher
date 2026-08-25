/* global cloneInto */

// console.log('isolated.js');
let port = self.port = document.getElementById('uas-port');

const id = (Math.random() + 1).toString(36).substring(7);

const override = reason => {
  const detail = typeof cloneInto === 'undefined' ? {id, reason} : cloneInto({id, reason}, self);
  port.dispatchEvent(new CustomEvent('override', {
    detail
  }));

  if (window === window.top) {
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
  // ignore XML documents
  if (port.dataset) {
    port.dataset.id = id;
    port.remove();
  }
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
  // cross-origin sandboxed iframe
  catch (e) {
    console.info('[user-agent leaked]', e, location.href);
  }
}

if (port && port.dataset) {
  // on per-tab only UA set, all tabs get injected, but only the spoofed tab
  // has "port.dataset.str"; others are intentionally disabled. bail out for
  // any disabled context (top or frame) so the async path never falsely logs
  // "[user-agent leaked]"
  if (port.dataset.disabled === 'true') {
    if (self === self.top) {
      console.info('[User-Agent Switcher and Manager]', 'disabled on this tab');
    }
  }
  else if (port.dataset.str) {
    override('normal');
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
      if (port.dataset.disabled === 'true') {
        // parent context is intentionally disabled (e.g. per-tab only UA);
        // nothing to spoof here, so do not fall back to the async path
      }
      else if (!port.dataset.str) {
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
