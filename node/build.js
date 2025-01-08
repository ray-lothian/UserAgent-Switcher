'use strict';

const fs = require('fs');
const path = require('path');
const UAParser = require('./ua-parser.min.js');

const cache = {};
const map = {
  browser: {},
  os: {},
  matching: {}
};
const invalids = [];


const parser = new UAParser();

const write = ({name, content}, callback) => fs.writeFile('../v3/data/popup/browsers/' + name, content, 'utf8', e => {
  if (e) {
    console.log(e);
  }
  setTimeout(callback, 0);
});

// reduce total number to < 400 entries while keeping the last 10 percent of uas
const reduce = (arr, length = 400) => {
  let pos = 1;
  while (arr.length > length) {
    arr.splice(pos, 1);
    pos += 1;
    pos = pos % (arr.length - Math.round(length / 10));
  }

  return arr;
};

fs.readdir('../v3/data/popup/browsers/', (err, files) => {
  if (err) throw err;
  for (const file of files) {
    fs.unlinkSync(path.join('../v3/data/popup/browsers/', file), err => {
      if (err) throw err;
    });
  }

  const next = (ua, source) => {
    ua = ua.trim();

    if (ua.length < 10) {
      invalids.push(['SHT', source, ua]);
      return console.log('[short agent  ]', source, ua);
    }
    if (ua.length > 400) {
      invalids.push(['LNG', source, ua]);
      return console.log('[long agent   ]', source, ua);
    }
    if (ua.indexOf('http') !== -1) {
      if (ua.indexOf('QtWeb') === -1 && ua.toLowerCase().indexOf('crawler') === -1 && ua.toLowerCase().indexOf('bot') === -1 && ua.toLowerCase().indexOf('spider') === -1) {
        invalids.push(['HTP', source, ua]);
        return console.log('[contains HTTP]', source, ua);
      }
    }
    parser.setUA(ua);
    const o = parser.getResult();

    // validate version number of well-known browsers
    if (o.browser.version && ['Chrome', 'Opera', 'Firefox', 'Yandex', 'Chromium', 'Brave', 'Edge'].includes(o.browser.name)) {
      const v = parseFloat(o.browser.version);
      if (v > 200) {
        return console.log('[Invalid Browser Version]', o.browser.version, source, ua);
      }
    }

    if (o.browser.name && o.os.name) {
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
    }
    else if (ua.toLowerCase().indexOf('bot') !== -1) {
      cache.bot = cache.bot || {
        'misc': []
      };
      cache.bot.misc.push(o);
      map.browser.bot = map.browser.bot || ['Bot'];
      map.os.misc = map.os.misc || ['Misc'];
    }
    else {
      invalids.push(['PRS', source, ua]);
      console.log('[cannot parse]', source, ua);
    }
  };

  console.log('BOTS');
  require('./assets/bots.json').forEach(ua => next(ua, 'BT'));
  for (const n of [...Array(27).keys()]) {
    const s = (n + 1).toString().padStart(2, 0);
    console.log('List', s);
    require(`./assets/list-${s}.json`).forEach(ua => next(ua, s));
  }

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

      fs.writeFile('invalids.txt', invalids.map(a => a.join(' ')).join('\n'), () => {});
      fs.writeFile('../v3/data/popup/map.json', JSON.stringify({
        browser: Object.values(map.browser).map(k => k[0]),
        os: Object.values(map.os).map(k => k[0]),
        matching: map.matching
      }), () => {});
    }
  };
  once();
});

