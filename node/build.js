'use strict';

var fs = require('fs');
var path = require('path');
var UAParser = require('./ua-parser.min.js');

var cache = {};
var map = {};

var parser = new UAParser();

var write = ({name, content}, callback) => fs.writeFile('./browsers/' + name, content, 'utf8', e => {
  if (e) {
    console.log(e);
  }
  setTimeout(callback, 0);
  console.log(name);
});

fs.readdir('./browsers/', async (err, files) => {
  if (err) throw err;
  for (const file of files) {
    fs.unlinkSync(path.join('./browsers/', file), err => {
      if (err) throw err;
    });
  }
  //
  const list = [
    ...require('./list-1.json'),
    ...require('./list-2.json')
  ].filter((s, i, l) => l.indexOf(s) === i);
  for (const ua of list) {
    parser.setUA(ua);
    const o = parser.getResult();
    if (o.browser.name && o.os.name) {
      if (o.os.name === 'WIndows') {
        continue;
      }
      cache[o.browser.name] = cache[o.browser.name] || {};
      map[o.browser.name] = map[o.browser.name] || {};
      cache[o.browser.name][o.os.name] = cache[o.browser.name][o.os.name] || [];
      map[o.browser.name][o.os.name] = map[o.browser.name][o.os.name] || true;
      cache[o.browser.name][o.os.name].push(o);
    }
    else {
      // console.log(ua);
    }
  }
  const contents = [];
  for (const browser of Object.keys(cache)) {
    for (const os of Object.keys(cache[browser])) {
      const name = browser + '-' + os.replace(/\//g, '-') + '.json';
      const content = JSON.stringify(cache[browser][os]);
      contents.push({
        name,
        content
      });
    }
  }
  const once = () => {
    const obj = contents.shift();
    if (obj) {
      write(obj, once);
    }
    else {
      console.log('done');
      fs.writeFile('./map.json', JSON.stringify(map), () => {});
    }
  };
  once();
});

