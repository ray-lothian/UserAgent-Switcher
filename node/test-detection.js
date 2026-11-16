'use strict';

// fixture tests for detect.js; run with: node node/test-detection.js

const {classify} = require('./detect.js');

const fixtures = [
  // ok: fully parsed, no structural damage
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'ok'],
  ['Mozilla/5.0 (Android 16; Mobile; rv:159.0) Gecko/159.0 Firefox/159.0', 'ok'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15', 'ok'],
  // GREASE tokens contain stray brackets on purpose and must stay valid
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Safari/537.36 Not/A)Brand/8', 'ok'],
  ['Mozilla/5.0 (Windows NT 10.0.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.139 Not(A:Brand/24 YaBrowser/24.4.5.498 Yowser/2.5 Safari/537.36', 'ok'],
  // nested Mozilla token inside parentheses (Acoo Browser style) is one agent
  ['Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0; GTB5; Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1) ; chromeframe; Avant Browser)', 'ok'],
  // multiple spaces and printable non-ascii are odd but valid
  ['Mozilla/5.0 (X11; Linux armv71;  rv:2.0b4pre) Gecko/20100818 Firefox/4.0b4pre Fennec/2.0a1pre', 'ok'],
  ['Mozilla/5.0 (iPad; CPU OS 10_15_5 (Ergänzendes Update) like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Mobile/15E148 Safari/604.1', 'ok'],
  // URL is allowed for the QtWeb browser
  ['Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/533.3 (KHTML, like Gecko) QtWeb Internet Browser/3.7 http://www.QtWeb.net', 'ok'],
  // versions outside the well-known browser list are not capped
  ['Mozilla/5.0 (Linux; U; Android 2.3.3; en-us; HTC_DesireS_S510e Build/GRI40) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1', 'ok'],
  // pre-release, esr and letter-suffixed versions of known browsers are valid
  ['Mozilla/5.0 (Windows NT 6.1; rv:15.0) Gecko/20120716 Firefox/15.0a2', 'ok'],
  ['Mozilla/5.0 (Windows NT 6.3; WOW64; x64; rv:140.0esr) Gecko/20100101 Firefox/140.0esr', 'ok'],
  ['Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1) Opera 7.54u1  [en]', 'ok'],

  // bot: known crawler keywords
  ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'bot'],
  ['Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'bot'],
  ['DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)', 'bot'],
  ['Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)', 'bot'],
  ['Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)', 'bot'],
  ['Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)', 'bot'],
  ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'bot'],
  ['ia_archiver (+http://www.alexa.com/site/help/webmasters; crawler@alexa.com)', 'bot'],

  // unknown: parses only partially but is not broken
  ['Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.1.0.346 Mobile Safari/534.11+', 'unknown', 'UNK'],
  ['SamsungI8910/SymbianOS/9.1 Series60/3.0', 'unknown', 'UNK'],
  ['NokiaE66/GoBrowser/2.0.297', 'unknown', 'UNK'],
  ['Doris/1.15 [en] (Symbian)', 'unknown', 'UNK'],

  // malformed: type
  [123, 'malformed', 'TYP'],
  [null, 'malformed', 'TYP'],
  // malformed: length
  ['', 'malformed', 'SHT'],
  ['Chrome/1', 'malformed', 'SHT'],
  ['Mozilla/5.0 ' + 'a'.repeat(400), 'malformed', 'LNG'],
  // malformed: control characters (tab-separated labels)
  ['Mozilla/5.0 (Windows NT 10.0; rv:68.0) Gecko/20100101 Firefox/68.0\tFirefox 68.0', 'malformed', 'CTL'],
  // malformed: string literals from python bytes or json slicing
  ["b'Mozilla/5.0 (X11; NetBSD amd64;) AppleWebKit/535.36 (KHTML, like Gecko) Chrome/51.0.2840.71 Safari/535.36'", 'malformed', 'LIT'],
  ['"Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1', 'malformed', 'LIT'],
  ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.3992.0 Safari/537.36\',)', 'malformed', 'LIT'],
  // malformed: truncated
  ['Mozilla/5.0 (Windows', 'malformed', 'TRN'],
  ['Opera/9.80 (J2ME/MIDP; Opera Mini/4.0 (Linux; U;', 'malformed', 'TRN'],
  ['Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0', 'malformed', 'TRN'],
  ['NokiaN86_8MP/GoBrowser/1.6.0.4868.208.92;', 'malformed', 'TRN'],
  // malformed: two agents concatenated
  ['Mozilla/5.0 Mozilla/5.0 (Windows; U; Windows NT 5.1; de; rv:1.9.2.13) Firefox/3.6.13', 'malformed', 'CAT'],
  ['Mozilla/5.0 (Windows; U; Windows NT 6.1; fr; rv:1.9.2.18) Gecko/20110614 Mozilla/5.0 (Android; Linux armv7l; rv:5.0) Gecko/20110614 Firefox/5.0', 'malformed', 'CAT'],
  // malformed: impossible versions of well-known browsers
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.4351.99 Safari/537.36', 'malformed', 'VER'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/0ADF80FA', 'malformed', 'VER'],
  // malformed: urls and addresses in non-bot agents
  ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 http://spam.example', 'malformed', 'URL'],
  // malformed: nothing parseable at all
  ['not-a-user-agent', 'malformed', 'PRS']
];

let failed = 0;
for (const [raw, category, code] of fixtures) {
  const c = classify(raw);
  const ok = c.category === category && (code === undefined || c.code === code);
  if (!ok) {
    failed += 1;
    console.log('FAIL expected %s/%s got %s/%s :: %s',
      category, code || '-', c.category, c.code || '-', String(raw).slice(0, 120));
  }
}
console.log('%d/%d fixtures passed', fixtures.length - failed, fixtures.length);
process.exit(failed ? 1 : 0);
