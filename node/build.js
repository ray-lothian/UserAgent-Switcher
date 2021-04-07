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

const parser = new UAParser();

const write = ({name, content}, callback) => fs.writeFile('../extension/firefox/data/popup/browsers/' + name, content, 'utf8', e => {
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

fs.readdir('../extension/firefox/data/popup/browsers/', async (err, files) => {
  if (err) throw err;
  for (const file of files) {
    fs.unlinkSync(path.join('../extension/firefox/data/popup/browsers/', file), err => {
      if (err) throw err;
    });
  }
  //
  const list = [
    ...require('./assets/list-01.json'),
    ...require('./assets/list-02.json'),
    ...require('./assets/list-03.json'),
    ...require('./assets/list-04.json'),
    ...require('./assets/list-05.json'),
    ...require('./assets/list-06.json'),
    ...require('./assets/list-07.json'),
    ...require('./assets/list-08.json'),
    ...require('./assets/list-09.json'),
    ...require('./assets/list-10.json'),
    ...require('./assets/list-11.json'),
    ...require('./assets/list-12.json'),
    ...require('./assets/list-13.json')
  ].filter((s, i, l) => l.indexOf(s) === i && ['fb_iab', 'fbsv', 'w3m', 'elinks'].some(k => s.toLowerCase().indexOf(k) !== -1) === false);
  for (const ua of list) {
    if (ua.startsWith('Mozilla/5.0 ') === false) {
      continue;
    }
    if (ua.length < 10) {
      console.log('[short agent]\t', ua);
    }
    if (ua.length > 200) {
      console.log('[long agent]\t', ua);
    }
    if (ua.indexOf('http') !== -1) {
      if (ua.indexOf('QtWeb') === -1 && ua.toLowerCase().indexOf('crawler') === -1 && ua.toLowerCase().indexOf('bot') === -1 && ua.toLowerCase().indexOf('spider') === -1) {
        console.log('[contains HTTP]\t', ua);
      }
    }
    parser.setUA(ua);
    const o = parser.getResult();
    if (o.browser.name && o.os.name) {
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
      // console.log('skipped', ua);
    }
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
          'kubuntu'
        ].some(k => k === s) === false);
        if (map.os[os].length > 1) {
          throw Error('Duplicated OS; add the ones that need to be removed to the list: ', map.os[os].join(', '));
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
          'chrome'
        ].some(k => k === s) === false);
        if (map.browser[browser].length > 1) {
          throw Error('Duplicated browser; add the ones that need to be removed to the list');
        }
      }

      fs.writeFile('../extension/firefox/data/popup/map.json', JSON.stringify({
        browser: Object.values(map.browser).map(k => k[0]),
        os: Object.values(map.os).map(k => k[0]),
        matching: map.matching
      }), () => {});
    }
  };
  once();
});

