'use strict';

// Evaluates the generated legacy rules (legacy.json) against the parsed
// user-agent entries of the generated browser lists. The rules mark
// end-of-life platforms, discontinued browser families and browser/engine
// versions below the supported floors. The user-agent JSON files themselves
// are never modified: the popup applies these rules at render time and
// offers to reveal the archived profiles at the end of the list.
// Missing, invalid or unavailable rules fail open: nothing is legacy.

const Legacy = {
  rules: null,
  set(data) {
    const ok = data && data.schemaVersion === 1 &&
      (data.os || data.browsers || data.engines) &&
      Object.keys(data).length >= 2;
    if (data && !ok) {
      console.warn('[legacy] unsupported rules; showing all profiles');
    }
    this.rules = ok ? data : null;
  },
  // bundled rules only; a failure keeps every profile visible
  async load() {
    try {
      const r = await fetch('legacy.json');
      if (!r.ok) {
        throw Error('HTTP ' + r.status);
      }
      this.set(await r.json());
    }
    catch (e) {
      console.warn('[legacy] rules unavailable; showing all profiles', e);
    }
  },
  isLegacy(agent) {
    const {rules} = this;
    if (!rules || !agent) {
      return false;
    }
    const match = (name, version, table) => {
      const rule = table[name];
      if (!rule) {
        return false;
      }
      if (rule.all === true) {
        return true;
      }
      const v = String(version == null ? '' : version).trim();
      if (Array.isArray(rule.prefixes)) {
        const lower = v.toLowerCase();
        if (rule.prefixes.some(p => lower.startsWith(String(p).toLowerCase()))) {
          return true;
        }
      }
      const m = /^(\d+)/.exec(v);
      const major = m ? Number(m[1]) : null;
      if (!v || major === null) {
        return rule.unknownIsLegacy === true;
      }
      if (rule.maxMajor !== undefined && major <= rule.maxMajor) {
        return true;
      }
      if (rule.maxVersion !== undefined) {
        // -1 or 0 -> version does not exceed the cutoff ("10.14.6" <= "10.14.99")
        const pa = v.split('.');
        const pb = String(rule.maxVersion).split('.');
        const length = Math.max(pa.length, pb.length);
        let d = 0;
        for (let i = 0; i < length && d === 0; i++) {
          d = (Number(pa[i]) || 0) - (Number(pb[i]) || 0);
        }
        if (d <= 0) {
          return true;
        }
      }
      return false;
    };
    return match(agent.os && agent.os.name, agent.os && agent.os.version, rules.os || {}) ||
      match(agent.browser && agent.browser.name, agent.browser && agent.browser.version, rules.browsers || {}) ||
      match(agent.engine && agent.engine.name, agent.engine && agent.engine.version, rules.engines || {});
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Legacy;
}
