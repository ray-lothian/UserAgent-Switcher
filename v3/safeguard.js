'use strict';

/* blocks untrusted payloads (remote server responses and imported backups)
   from writing security-sensitive storage keys and values of wrong types;
   ignored keys are reported on the console */

const PREF_TYPES = {
  'mode': v => ['blacklist', 'whitelist', 'custom'].includes(v),
  'ua': v => typeof v === 'string',
  'user-styling': v => typeof v === 'string',
  'popup-browser': v => typeof v === 'string',
  'popup-os': v => typeof v === 'string',
  'popup-sort': v => typeof v === 'string',
  'test': v => typeof v === 'string',
  'userAgentData': v => typeof v === 'boolean',
  'pageContextMenus': v => typeof v === 'boolean',
  'blacklist': v => Array.isArray(v) && v.every(e => typeof e === 'string'),
  'whitelist': v => Array.isArray(v) && v.every(e => typeof e === 'string'),
  'protected': v => Array.isArray(v) && v.every(e => typeof e === 'string'),
  'popular-oss': v => Array.isArray(v) && v.every(e => typeof e === 'string'),
  'popular-browsers': v => Array.isArray(v) && v.every(e => typeof e === 'string'),
  'custom': v => typeof v === 'object' && v !== null && Array.isArray(v) === false,
  'parser': v => typeof v === 'object' && v !== null && Array.isArray(v) === false
};

// keys that no untrusted payload is allowed to write;
// 'import' level is more permissive (backup/restore fidelity)
const BLOCKED_KEYS = ['remote-address', 'json-guid', 'json-forced', 'last-update', 'faqs'];
const BLOCKED_PREFIXES = ['cache.'];
const IMPORT_BLOCKED_KEYS = ['json-forced', 'last-update'];
const IMPORT_BLOCKED_PREFIXES = ['cache.'];

function sanitizePrefs(j, level = 'remote') {
  const blocked = level === 'import' ? IMPORT_BLOCKED_KEYS : BLOCKED_KEYS;
  const prefixes = level === 'import' ? IMPORT_BLOCKED_PREFIXES : BLOCKED_PREFIXES;
  const prefs = {};
  const ignored = [];
  for (const [key, value] of Object.entries(j || {})) {
    if (blocked.includes(key)) {
      ignored.push([key, 'blocked key']);
      continue;
    }
    if (prefixes.some(p => key.startsWith(p))) {
      ignored.push([key, 'blocked key prefix']);
      continue;
    }
    const check = PREF_TYPES[key];
    if (check && !check(value)) {
      ignored.push([key, 'wrong type']);
      continue;
    }
    prefs[key] = value;
  }
  for (const [key, reason] of ignored) {
    console.warn('[safeguard] ignored key "' + key + '" (' + reason + ')');
  }
  return {prefs, ignored};
}

// stable comparison of possibly nested preference values
const canonical = v => {
  if (v === undefined) {
    return 'undefined';
  }
  if (v === null || typeof v !== 'object') {
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    return '[' + v.map(canonical).join(',') + ']';
  }
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
};

function prefDiff(current, prefs) {
  const changed = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (canonical(current[key]) !== canonical(value)) {
      changed[key] = value;
    }
  }
  return changed;
}
