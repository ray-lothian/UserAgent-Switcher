'use strict';

// numeric prefix of a version; "160.0.0.0" -> [160], "140.0esr" -> [140];
// returns null for versions without a numeric prefix (CrossApp, ADR-...)
const versionRank = v => {
  const m = /^\d+(?:\.\d+)*/.exec(v || '');
  return m ? m[0].split('.').map(Number) : null;
};

// ascending; non-numeric versions sort as the oldest
const compareVersions = (a, b) => {
  const ra = versionRank(a);
  const rb = versionRank(b);
  if (ra === null && rb === null) {
    return 0;
  }
  if (ra === null) {
    return -1;
  }
  if (rb === null) {
    return 1;
  }
  for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
    const x = ra[i] || 0;
    const y = rb[i] || 0;
    if (x !== y) {
      return x - y;
    }
  }
  return 0;
};

const byVersion = (a, b) => compareVersions(a.browser.version, b.browser.version);

// cap the list to < length entries while keeping the newest versions and
// still reaching back to the oldest one: the newest share is filled from
// the highest versions (at most maxPerVersion entries per exact version so
// variants do not crowd out the rest), the remaining slots are evenly
// spaced over the older entries starting at the oldest one
const reduce = (arr, length = 400, newest = 0.65, maxPerVersion = 2) => {
  if (arr.length <= length) {
    return arr;
  }

  const sorted = arr.slice().sort(byVersion);

  // group entries by exact version; groups keep ascending order
  const groups = new Map();
  for (const o of sorted) {
    const v = o.browser.version || '_';
    if (groups.has(v)) {
      groups.get(v).push(o);
    }
    else {
      groups.set(v, [o]);
    }
  }
  const versions = [...groups.keys()].sort(compareVersions);

  const keepNew = Math.min(Math.round(length * newest), length);
  const picked = [];
  const used = new Set();

  for (let pass = 1; pass <= maxPerVersion && picked.length < keepNew; pass++) {
    for (let k = versions.length - 1; k >= 0 && picked.length < keepNew; k--) {
      const group = groups.get(versions[k]);
      if (group.length >= pass) {
        const o = group[group.length - pass];
        picked.push(o);
        used.add(o);
      }
    }
  }

  // few distinct versions: top up from the newest entries
  for (let i = sorted.length - 1; i >= 0 && picked.length < keepNew; i--) {
    if (!used.has(sorted[i])) {
      picked.push(sorted[i]);
      used.add(sorted[i]);
    }
  }

  const older = sorted.filter(o => !used.has(o));
  const target = length - picked.length;
  const sample = [];
  for (let i = 0; i < target; i++) {
    sample.push(older[Math.min(older.length - 1, Math.floor(i * older.length / target))]);
  }

  return sample.concat(picked).sort(byVersion);
};

module.exports = {reduce, compareVersions};
