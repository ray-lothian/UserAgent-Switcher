'use strict';

const UAParser = require('./ua-parser.min.js');

// a user agent is rejected when it is structurally broken (truncated,
// concatenated, wrapped in quotes, ...), carries a URL or e-mail address,
// or reports an impossible version number for a well-known browser;
// agents that parse only partially are reported as unknown instead
const MIN_LENGTH = 10;
const MAX_LENGTH = 400;
const MAX_MAJOR = 200;

// versions of these browsers are checked for impossible values
const VERSION_BROWSERS = ['Chrome', 'Opera', 'Firefox', 'Yandex', 'Chromium', 'Brave', 'Edge'];

// versions are malformed when they look like hex build ids or impossible
// major numbers; suffixed versions (3.1b3, 139.0esr, 15.0a2, 7.54u1) are valid
const HEX_VERSION_RE = /^[0-9a-f]{6,}$/i;
const NUMERIC_VERSION_RE = /^\d+(?:\.\d+)*$/;
const CONTROL_RE = /[\x00-\x1f\x7f]/;
const LITERAL_START_RE = /^(?:b['"]|['"])/i;
const LITERAL_END_RE = /['"],?[)\]]*$/;
const TRAILING_SEP_RE = /[;,(/]$/;
const BOT_RE = /bot|crawler|spider|slurp|archiver|scraper|fetcher|externalhit/i;
const URL_RE = /https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const GREASE_RE = /\bNot.{0,3}Brand(?:\/[\d.]+)?/gi;

const parser = new UAParser();

// number of unclosed parentheses; GREASE tokens (Not/A)Brand, Not(A:Brand)
// intentionally contain stray brackets and are removed before counting
const unclosed = ua => {
  let depth = 0;
  for (const ch of ua.replace(GREASE_RE, '')) {
    if (ch === '(') {
      depth += 1;
    }
    else if (ch === ')') {
      depth -= 1;
    }
  }
  return depth;
};

// number of Mozilla/<version> tokens sitting outside any parentheses;
// more than one means two user agents were concatenated
const mozillaTokens = ua => {
  let depth = 0;
  let count = 0;
  const re = /\(|\)|Mozilla\/[\d.]+/g;
  let m;
  while ((m = re.exec(ua)) !== null) {
    if (m[0] === '(') {
      depth += 1;
    }
    else if (m[0] === ')') {
      depth = Math.max(depth - 1, 0);
    }
    else if (depth === 0) {
      count += 1;
    }
  }
  return count;
};

const badVersion = (name, version) => {
  if (!version || VERSION_BROWSERS.indexOf(name) === -1) {
    return false;
  }
  if (/[a-f]/i.test(version) && HEX_VERSION_RE.test(version)) {
    return true;
  }
  return NUMERIC_VERSION_RE.test(version) && parseInt(version, 10) > MAX_MAJOR;
};

// returns {category, code, ua, result}
//   category: 'ok' | 'bot' | 'unknown' | 'malformed'
//   code:     short reason for unknown and malformed, otherwise null
//   ua:       normalized (BOM-stripped, trimmed) agent
//   result:   ua-parser result when the agent got parsed, otherwise null
const classify = raw => {
  if (typeof raw !== 'string') {
    return {category: 'malformed', code: 'TYP', ua: String(raw), result: null};
  }

  const ua = raw.replace(/^\uFEFF/, '').trim();

  if (ua.length < MIN_LENGTH) {
    return {category: 'malformed', code: 'SHT', ua, result: null};
  }
  if (ua.length > MAX_LENGTH) {
    return {category: 'malformed', code: 'LNG', ua, result: null};
  }
  if (CONTROL_RE.test(ua)) {
    return {category: 'malformed', code: 'CTL', ua, result: null};
  }
  if (LITERAL_START_RE.test(ua) || LITERAL_END_RE.test(ua)) {
    return {category: 'malformed', code: 'LIT', ua, result: null};
  }
  if (unclosed(ua) > 0 || TRAILING_SEP_RE.test(ua)) {
    return {category: 'malformed', code: 'TRN', ua, result: null};
  }
  if (mozillaTokens(ua) > 1) {
    return {category: 'malformed', code: 'CAT', ua, result: null};
  }

  const result = parser.setUA(ua).getResult();
  const full = Boolean(result.browser.name && result.os.name);
  const bot = BOT_RE.test(ua);

  // crawlers skip the URL check and are only reported as bots when they
  // do not parse into a browser running on an os
  if (bot && !full) {
    return {category: 'bot', code: null, ua, result};
  }
  if (!bot && URL_RE.test(ua) && ua.indexOf('QtWeb') === -1) {
    return {category: 'malformed', code: 'URL', ua, result};
  }
  if (badVersion(result.browser.name, result.browser.version)) {
    return {category: 'malformed', code: 'VER', ua, result};
  }
  if (full) {
    return {category: 'ok', code: null, ua, result};
  }
  if (result.browser.name || result.os.name) {
    return {category: 'unknown', code: 'UNK', ua, result};
  }
  return {category: 'malformed', code: 'PRS', ua, result};
};

module.exports = {classify};
