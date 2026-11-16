'use strict';

// fixture tests for reduce.js; run with: node node/test-reduce.js

const {reduce, compareVersions} = require('./reduce.js');

const entry = version => ({browser: {name: 'Test', version}});

// n copies of each version
const bucket = (versions, n) => {
  const arr = [];
  for (let i = 0; i < n; i++) {
    for (const v of versions) {
      arr.push(entry(v));
    }
  }
  return arr;
};

let failed = 0;
const check = (label, condition, detail) => {
  if (!condition) {
    failed += 1;
    console.log('FAIL', label, detail === undefined ? '' : ':: ' + detail);
  }
};

// small inputs are returned untouched
{
  const arr = bucket(['1.0', '2.0', '3.0'], 20);
  check('unchanged when short', reduce(arr) === arr);
}

// version comparison order, including non-numeric suffixes
{
  const order = ['CrossApp', '0.2.149.6', '7.54u1', '15.0a2', '140.0esr', '160.0'];
  for (let i = 1; i < order.length; i++) {
    check('compareVersions ' + order[i - 1] + ' < ' + order[i],
      compareVersions(order[i - 1], order[i]) < 0);
  }
}

// full-length output, sorted, spanning oldest to newest
{
  const versions = [];
  for (let v = 1; v <= 1000; v++) {
    versions.push(v + '.0');
  }
  const arr = bucket(versions, 1); // 1000 entries, 1000 distinct versions
  const out = reduce(arr);
  check('capped to length', out.length === 400, String(out.length));
  check('sorted ascending', out.every((o, i) => i === 0 || compareVersions(out[i - 1].browser.version, o.browser.version) <= 0));
  check('oldest kept', out[0].browser.version === '1.0');
  check('newest kept', out[out.length - 1].browser.version === '1000.0');
  // the newest share covers the highest 260 of the 1000 versions
  const kept = new Set(out.map(o => o.browser.version));
  const missing = [];
  for (let v = 741; v <= 1000; v++) {
    if (!kept.has(v + '.0')) {
      missing.push(v);
    }
  }
  check('newest share covers top 260 versions', missing.length === 0, missing.join(' '));
}

// at most maxPerVersion copies per version when versions are plentiful
{
  const versions = [];
  for (let v = 1; v <= 1000; v++) {
    versions.push(v + '.0');
  }
  const arr = bucket(versions, 2); // 2000 entries, 2 copies per version
  const out = reduce(arr);
  const copies = new Map();
  for (const o of out) {
    copies.set(o.browser.version, (copies.get(o.browser.version) || 0) + 1);
  }
  const max = Math.max(...copies.values());
  check('per-version cap', max <= 2, 'max copies ' + max);
  check('all versions reachable', copies.size >= 350, String(copies.size));
}

// few distinct versions: every version survives
{
  const arr = bucket(['5.0', '10.0', '20.0', '50.0', '100.0'], 200); // 1000 entries
  const out = reduce(arr);
  const kept = new Set(out.map(o => o.browser.version));
  check('length kept', out.length === 400, String(out.length));
  check('all versions kept', ['5.0', '10.0', '20.0', '50.0', '100.0'].every(v => kept.has(v)), [...kept].join(' '));
  check('oldest kept', out[0].browser.version === '5.0');
  check('newest kept', out[out.length - 1].browser.version === '100.0');
}

// suffixed and non-numeric versions are ordered and never dropped
{
  const arr = bucket(['CrossApp', '7.54u1', '15.0a2', '140.0esr', '160.0'], 100);
  const out = reduce(arr);
  const kept = new Set(out.map(o => o.browser.version));
  check('special versions kept', kept.size === 5, [...kept].join(' '));
  check('special versions sorted', out[0].browser.version === 'CrossApp' && out[out.length - 1].browser.version === '160.0');
  check('special length kept', out.length === 400, String(out.length));
}

// missing or empty versions do not break the sort
{
  const arr = [entry(undefined), entry(''), entry('10.0')];
  for (let i = 0; i < 500; i++) {
    arr.push(entry((i % 50 + 1) + '.0'));
  }
  const out = reduce(arr);
  check('empty versions tolerated', out.length === 400 && out.every(o => typeof o.browser.version !== 'object'), String(out.length));
}

console.log(failed ? failed + ' checks failed' : 'all checks passed');
process.exit(failed ? 1 : 0);
