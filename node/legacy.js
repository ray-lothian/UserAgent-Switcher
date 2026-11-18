'use strict';

// Generates v3/data/popup/legacy.json from the policy below.
//
// The generated rules mark the user-agent profiles the popup hides by
// default: end-of-life platforms, discontinued browser families and
// browser/engine versions below the supported floors. The user-agent JSON
// files themselves are never modified; the popup evaluates these rules at
// render time (see v3/data/popup/legacy.js) and offers to reveal the
// archived profiles at the end of the list.
//
// Re-generate with: node node/legacy.js

const fs = require('fs');
const path = require('path');
const Legacy = require('../v3/data/popup/legacy.js');

// policy; adjust here and re-run the generator
const POLICY = {
  os: {
    // Chrome 138 was the last release supporting Android 8 and 9; the frozen
    // UA of modern Chrome reports Android 10, which stays visible
    Android: {maxMajor: 9, unknownIsLegacy: true},
    // iOS 15 does not receive current Safari releases anymore
    iOS: {maxMajor: 15, unknownIsLegacy: true},
    // current Safari keeps reporting macOS 10.15.7; 10.14 and older are EOL
    'Mac OS': {maxVersion: '10.14.99', unknownIsLegacy: true},
    // Windows 11 still reports NT 10.0 ("10"); versions below 10 are EOL.
    // Raw "NT x" versions are unmatched legacy claims (there is no NT 11)
    Windows: {
      prefixes: ['XP', 'Vista', '2000', '98', '95', 'ME', '7', '8', '8.1', 'NT', 'CE']
    },
    // discontinued platforms
    Symbian: {all: true},
    Maemo: {all: true},
    BlackBerry: {all: true},
    'Windows Phone': {all: true},
    'Windows Phone OS': {all: true},
    'Windows Mobile': {all: true},
    'Windows CE': {all: true},
    BeOS: {all: true},
    'OS/2': {all: true},
    AmigaOS: {all: true},
    OpenVMS: {all: true},
    QNX: {all: true},
    'HP-UX': {all: true},
    AIX: {all: true},
    'RISC OS': {all: true}
  },
  browsers: {
    // Chromium-family: Chrome 120 (Dec 2023) is the oldest supported base
    Chrome: {maxMajor: 119},
    'Mobile Chrome': {maxMajor: 119},
    'Chrome WebView': {maxMajor: 119},
    Chromium: {maxMajor: 119},
    Edge: {maxMajor: 119},
    // Firefox 128 ESR (Jul 2024); ESR 115 only serves Win 7/8.1 and macOS 10.12-10.14
    Firefox: {maxMajor: 127},
    'Mobile Firefox': {maxMajor: 127},
    // Safari 16 (Sep 2022) is the oldest release receiving current updates
    Safari: {maxMajor: 15},
    'Mobile Safari': {maxMajor: 15},
    // discontinued browser families
    IE: {all: true},
    IEMobile: {all: true},
    Netscape: {all: true},
    Camino: {all: true},
    Chimera: {all: true},
    Flock: {all: true},
    Mosaic: {all: true},
    Firebird: {all: true},
    Phoenix: {all: true},
    Minimo: {all: true},
    Skyfire: {all: true},
    RockMelt: {all: true},
    Blazer: {all: true},
    BOLT: {all: true},
    'Maemo Browser': {all: true},
    'Opera Tablet': {all: true},
    'Android Browser': {all: true},
    WebKit: {all: true},
    // Presto-era naming only survives as Opera Mobi/Opera Mini
    Opera: {prefixes: ['Mobi', 'Mini', 'ADR-']}
  },
  engines: {
    // EdgeHTML and Presto have no current releases
    EdgeHTML: {all: true},
    Presto: {all: true},
    // Chromium 120 floor also covers Chromium-based browsers whose own
    // version numbering is not comparable (Brave, Vivaldi, Yandex, ...)
    Blink: {maxMajor: 119}
  }
};

const rules = {
  schemaVersion: 1,
  generated: new Date().toISOString().slice(0, 10),
  ...POLICY
};

const outDir = path.join(__dirname, '..', 'v3', 'data', 'popup');
fs.writeFileSync(path.join(outDir, 'legacy.json'), JSON.stringify(rules, null, 2) + '\n');

// report the effect of the policy on the generated lists
Legacy.set(rules);
const browserDir = path.join(outDir, 'browsers');
let total = 0;
let legacy = 0;
for (const file of fs.readdirSync(browserDir).filter(f => f.endsWith('.json')).sort()) {
  const list = JSON.parse(fs.readFileSync(path.join(browserDir, file), 'utf8'));
  total += list.length;
  legacy += list.reduce((n, o) => n + (Legacy.isLegacy(o) ? 1 : 0), 0);
}
console.log('legacy.json written; profiles=%d legacy=%d visible=%d', total, legacy, total - legacy);
