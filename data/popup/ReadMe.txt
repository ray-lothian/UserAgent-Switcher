ua-parser.min.js:
  https://github.com/faisalman/ua-parser-js/blob/master/dist/ua-parser.min.js

Generating the list:
  Run
  JSON.stringify([...document.querySelectorAll('li a')].map(a => a.textContent))
  on
  http://www.useragentstring.com/pages/useragentstring.php?typ=Browser
