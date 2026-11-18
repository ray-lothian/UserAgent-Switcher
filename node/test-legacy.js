'use strict';

// fixture tests for the popup legacy rules; run with: node node/test-legacy.js

const fs = require('fs');
const path = require('path');
const Legacy = require('../v3/data/popup/legacy.js');

const rules = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'v3', 'data', 'popup', 'legacy.json'), 'utf8'));

const agent = (os, browser, engine) => ({
  os: os || {},
  browser: browser || {},
  engine: engine || {},
  device: {},
  cpu: {}
});

let failed = 0;
const check = (label, condition, detail) => {
  if (!condition) {
    failed += 1;
    console.log('FAIL', label, detail === undefined ? '' : ':: ' + detail);
  }
};

// the generated rules must be accepted by the evaluator; a live rule is
// proven by any positive fixture below (fail-open never returns true)
Legacy.set(rules);

const fixtures = [
  // os cutoffs
  [agent({name: 'Android', version: '9'}, {name: 'Chrome', version: '88.0.4324.96'}), true, 'Android 9'],
  [agent({name: 'Android', version: '9.0'}, {name: 'Chrome', version: '88.0'}), true, 'Android 9.0'],
  [agent({name: 'Android', version: '10'}, {name: 'Chrome', version: '155.0.0.0'}), false, 'Android 10'],
  [agent({name: 'Android', version: '16'}), false, 'Android 16'],
  [agent({name: 'Android', version: ''}, {name: 'Chrome', version: '155.0'}), true, 'Android unknown version'],
  [agent({name: 'iOS', version: '15.8.8'}), true, 'iOS 15'],
  [agent({name: 'iOS', version: '16.6'}), false, 'iOS 16'],
  [agent({name: 'Windows', version: 'XP'}), true, 'Windows XP'],
  [agent({name: 'Windows', version: '7'}, {name: 'Firefox', version: '128.0'}), true, 'Windows 7'],
  [agent({name: 'Windows', version: '8.1'}), true, 'Windows 8.1'],
  [agent({name: 'Windows', version: 'NT 4.0'}), true, 'Windows NT 4.0'],
  [agent({name: 'Windows', version: 'NT 11.0'}), true, 'Windows NT 11.0 claim'],
  [agent({name: 'Windows', version: '10'}, {name: 'Chrome', version: '155.0.0.0'}), false, 'Windows 10'],
  [agent({name: 'Mac OS', version: '10.14.6'}), true, 'macOS 10.14'],
  [agent({name: 'Mac OS', version: '10.15.7'}, {name: 'Safari', version: '27.2'}), false, 'macOS 10.15'],
  [agent({name: 'Mac OS', version: '13'}, {name: 'Safari', version: '17'}), false, 'macOS 13'],
  [agent({name: 'Mac OS', version: 'Mach-O'}), true, 'macOS unknown version'],
  [agent({name: 'Symbian', version: '9.1'}), true, 'Symbian'],
  [agent({name: 'Windows Phone', version: '10.0'}), true, 'Windows Phone'],
  [agent({name: 'BlackBerry', version: '9900'}), true, 'BlackBerry'],
  // browser cutoffs and discontinued families
  [agent({name: 'Windows', version: '10'}, {name: 'IE', version: '11'}), true, 'IE'],
  [agent({name: 'Windows', version: '10'}, {name: 'Chrome', version: '119.0.0.0'}), true, 'Chrome 119'],
  [agent({name: 'Windows', version: '10'}, {name: 'Chrome', version: '120.0.0.0'}), false, 'Chrome 120'],
  [agent({name: 'Windows', version: '10'}, {name: 'Chromium', version: '118.0'}), true, 'Chromium 118'],
  [agent({name: 'Windows', version: '10'}, {name: 'Firefox', version: '127.0'}), true, 'Firefox 127'],
  [agent({name: 'Windows', version: '10'}, {name: 'Firefox', version: '128.0'}), false, 'Firefox 128'],
  [agent({name: 'Mac OS', version: '10.15.7'}, {name: 'Safari', version: '15.6.1'}), true, 'Safari 15'],
  [agent({name: 'Mac OS', version: '10.15.7'}, {name: 'Safari', version: '16.0'}), false, 'Safari 16'],
  [agent({name: 'iOS', version: '16.6'}, {name: 'Mobile Safari', version: '16.6.1'}), false, 'Mobile Safari 16'],
  [agent({name: 'Android', version: '10'}, {name: 'Android Browser', version: '4.0'}), true, 'Android Browser'],
  // engine floors cover derived browsers with their own versioning
  [agent({name: 'Android', version: '10'}, {name: 'Brave', version: '74'}, {name: 'Blink', version: '74.0.3729.157'}), true, 'Brave 74 (Blink 74)'],
  [agent({name: 'Android', version: '10'}, {name: 'Brave', version: '1.97.59'}, {name: 'Blink', version: '155.0.0.0'}), false, 'Brave 1.97 (Blink 155)'],
  [agent({name: 'Android', version: '10'}, {name: 'Samsung Internet', version: '13.2'}, {name: 'Blink', version: '87.0.4280.101'}), true, 'Samsung Internet 13.2 (Blink 87)'],
  [agent({name: 'Android', version: '10'}, {name: 'Samsung Internet', version: '31.0'}, {name: 'Blink', version: '151.0.0.0'}), false, 'Samsung Internet 31 (Blink 151)'],
  [agent({name: 'Windows', version: '10'}, {name: 'Edge', version: '44.17763'}, {name: 'EdgeHTML', version: '18'}), true, 'EdgeHTML'],
  [agent({name: 'Windows', version: '10'}, {name: 'Opera', version: '12.16'}, {name: 'Presto', version: '12.16'}), true, 'Presto'],
  [agent({name: 'Windows', version: '10'}, {name: 'Opera', version: 'Mobi'}), true, 'Opera Mobi prefix'],
  [agent({name: 'Android', version: '10'}, {name: 'Opera', version: '141.0.0.0'}, {name: 'Blink', version: '141'}), false, 'Opera 141'],
  // engines without a policy never decide alone
  [agent({name: 'Windows', version: '10'}, {name: 'PaleMoon', version: '33'}, {name: 'Goanna', version: '6'}), false, 'Goanna untouched'],
  [agent({name: 'Windows', version: '10'}, {name: 'Chrome', version: '155.0.0.0'}, {name: 'WebKit', version: '537.36'}), false, 'WebKit token ignored'],
  // partial and empty agents
  [agent({name: 'Chrome', version: '155.0.0.0'}), false, 'browser only'],
  [agent(), false, 'empty agent'],
  [null, false, 'null agent']
];

for (const [a, expected, label] of fixtures) {
  check(label, Legacy.isLegacy(a) === expected, 'expected ' + expected + ' got ' + Legacy.isLegacy(a));
}

// fail-open behavior: unusable rules must never hide anything
Legacy.set(null);
check('missing rules fail open', Legacy.isLegacy(fixtures[0][0]) === false);
Legacy.set({schemaVersion: 2});
check('unsupported schema fails open', Legacy.isLegacy(fixtures[0][0]) === false);
Legacy.set({schemaVersion: 1});
check('rules without sections fail open', Legacy.isLegacy(fixtures[0][0]) === false);
Legacy.set(rules);

// the evaluator and the generator agree on the whole generated database
let total = 0;
let legacy = 0;
const browserDir = path.join(__dirname, '..', 'v3', 'data', 'popup', 'browsers');
for (const file of fs.readdirSync(browserDir).filter(f => f.endsWith('.json'))) {
  const list = JSON.parse(fs.readFileSync(path.join(browserDir, file), 'utf8'));
  total += list.length;
  legacy += list.reduce((n, o) => n + (Legacy.isLegacy(o) ? 1 : 0), 0);
}
check('a meaningful subset is archived', legacy > 0 && legacy < total, legacy + '/' + total);

console.log('%d/%d fixtures passed; %d of %d generated profiles are legacy',
  fixtures.length - failed, fixtures.length, legacy, total);
process.exit(failed ? 1 : 0);
