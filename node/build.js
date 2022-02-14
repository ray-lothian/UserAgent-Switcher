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
      invalids.push(['PRS', source, ua]);
      console.log('[cannot parse ]', source, ua);
    }
  };

  console.log('BOTS');
  require('./assets/bots.json').forEach(ua => next(ua, 'BT'));
  console.log('List 01');
  require('./assets/list-01.json').forEach(ua => next(ua, '01'));
  console.log('List 02');
  require('./assets/list-02.json').forEach(ua => next(ua, '02'));
  console.log('List 03');
  require('./assets/list-03.json').forEach(ua => next(ua, '03'));
  console.log('List 04');
  require('./assets/list-04.json').forEach(ua => next(ua, '04'));
  console.log('List 05');
  require('./assets/list-05.json').forEach(ua => next(ua, '05'));
  console.log('List 06');
  require('./assets/list-06.json').forEach(ua => next(ua, '06'));
  console.log('List 07');
  require('./assets/list-07.json').forEach(ua => next(ua, '07'));
  console.log('List 08');
  require('./assets/list-08.json').forEach(ua => next(ua, '08'));
  console.log('List 09');
  require('./assets/list-09.json').forEach(ua => next(ua, '09'));
  console.log('List 10');
  require('./assets/list-10.json').forEach(ua => next(ua, '10'));
  console.log('List 11');
  require('./assets/list-11.json').forEach(ua => next(ua, '11'));
  console.log('List 12');
  require('./assets/list-12.json').forEach(ua => next(ua, '12'));
  console.log('List 13');
  require('./assets/list-13.json').forEach(ua => next(ua, '13'));
  console.log('List 14');
  require('./assets/list-14.json').forEach(ua => next(ua, '14'));
  console.log('List 15');
  require('./assets/list-15.json').forEach(ua => next(ua, '15'));
  console.log('List 16');
  require('./assets/list-16.json').forEach(ua => next(ua, '16'));
  console.log('List 17');
  require('./assets/list-17.json').forEach(ua => next(ua, '17'));
  console.log('List 18');
  require('./assets/list-18.json').forEach(ua => next(ua, '18'));

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
      fs.writeFile('../extension/firefox/data/popup/map.json', JSON.stringify({
        browser: Object.values(map.browser).map(k => k[0]),
        os: Object.values(map.os).map(k => k[0]),
        matching: map.matching
      }), () => {});
    }
  };
  once();
});

