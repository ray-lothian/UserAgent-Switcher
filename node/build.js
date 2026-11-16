'use strict';

const fs = require('fs');
const path = require('path');
const {classify} = require('./detect.js');
const {reduce} = require('./reduce.js');

const dir = __dirname;
const outDir = path.join(dir, '..', 'v3', 'data', 'popup', 'browsers');

const cache = {};
const map = {
  browser: {},
  os: {},
  matching: {}
};
const invalids = [];
const seen = new Set();
const stats = {ok: 0, bot: 0, unknown: 0, malformed: 0};

const print = (code, file, ...args) => {
  console.log('\x1b[31m%s\x1b[0m \x1b[32m%s\x1b[0m %s', code.padEnd(25, ' '), file, ...args);
};

const write = ({name, content}, callback) => fs.writeFile(path.join(outDir, name), content, 'utf8', e => {
  if (e) {
    console.log(e);
  }
  setTimeout(callback, 0);
});

fs.readdir(outDir, (err, files) => {
  if (err) throw err;
  for (const file of files) {
    fs.unlinkSync(path.join(outDir, file));
  }

  const next = (ua, source) => {
    const c = classify(ua);

    // report every user agent only once, even when listed in several files
    if (seen.has(c.ua)) {
      return;
    }
    seen.add(c.ua);
    stats[c.category] += 1;

    if (c.category === 'malformed' || c.category === 'unknown') {
      const tag = c.category === 'unknown' ? '[unknown]' : '[malformed]';
      invalids.push([tag, c.code, source, c.ua]);
      return print(tag + ' ' + c.code, source, c.ua);
    }

    const o = c.result;

    if (c.category === 'bot') {
      cache.bot = cache.bot || {
        'misc': []
      };
      cache.bot.misc.push(o);
      map.browser.bot = map.browser.bot || ['Bot'];
      map.os.misc = map.os.misc || ['Misc'];
      return;
    }

    if (o.os.name === 'macOS') {
      o.os.name = 'Mac OS';
    }
    else if (o.os.name === 'Chrome OS') {
      o.os.name = 'Chromium OS';
    }

    const bb = o.browser.name.toLowerCase();
    const ss = o.os.name.toLowerCase();

    cache[bb] = cache[bb] || {};
    cache[bb][ss] = cache[bb][ss] || [];
    cache[bb][ss].push(o);

    map.browser[bb] = map.browser[bb] || [];
    map.browser[bb].push(o.browser.name);

    map.os[ss] = map.os[ss] || [];
    map.os[ss].push(o.os.name);
  };

  {
    const files = fs.readdirSync(path.join(dir, 'assets')).sort();
    for (const file of files) {
      console.log(' -> Working on', file);
      if (file.endsWith('.json')) {
        require(path.join(dir, 'assets', file)).forEach(ua => next(ua, file));
      }
    }
  }

  // flush the report before the duplicated-name assertions below can throw
  fs.writeFile(path.join(dir, 'invalids.txt'), invalids.map(a => a.join(' ')).join('\n'), () => {});
  console.log('ok=%d bot=%d unknown=%d malformed=%d', stats.ok, stats.bot, stats.unknown, stats.malformed);

  const contents = [];
  for (const browser of Object.keys(cache)) {
    for (const os of Object.keys(cache[browser])) {
      const name = browser + '-' + os.replace(/\//g, '-') + '.json';
      const uas = cache[browser][os];
      const content = JSON.stringify(reduce(uas));
      contents.push({
        name,
        content
      });
      map.matching[browser] = map.matching[browser] || [];
      if (map.matching[browser].indexOf(os) === -1) {
        map.matching[browser].push(os);
      }
    }
  }
  const once = () => {
    const obj = contents.shift();
    if (obj) {
      write(obj, once);
    }
    else {
      for (const os of Object.keys(map.os)) {
        map.os[os] = map.os[os].filter((s, i, l) => l.indexOf(s) === i && [
          'UNIX',
          'debian',
          'gentoo',
          'ubuntu',
          'WIndows',
          'kubuntu',
          'PLAYSTATION'
        ].some(k => k === s) === false);
        if (map.os[os].length > 1) {
          console.log(map.os[os]);
          throw Error(`Duplicated OS; add the ones that need to be removed to the list: "${os}"`);
        }
      }
      for (const browser of Object.keys(map.browser)) {
        map.browser[browser] = map.browser[browser].filter((s, i, l) => l.indexOf(s) === i && [
          'Webkit',
          'MAXTHON',
          'conkeror',
          'icecat',
          'Iceweasel',
          'iceweasel',
          'midori',
          'Palemoon',
          'Seamonkey',
          'chrome',
          'links',
          'brave'
        ].some(k => k === s) === false);
        if (map.browser[browser].length > 1) {
          console.log(map.browser[browser]);
          throw Error(`Duplicated browser; add the ones that need to be removed to the list: ${browser}`);
        }
      }

      fs.writeFile(path.join(dir, '..', 'v3', 'data', 'popup', 'map.json'), JSON.stringify({
        browser: Object.values(map.browser).map(k => k[0]),
        os: Object.values(map.os).map(k => k[0]),
        matching: map.matching
      }), () => {});
    }
  };
  once();
});
