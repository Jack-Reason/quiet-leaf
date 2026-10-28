const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(process.env.QL_SOURCE || path.join(__dirname, '../Quiet-Leaf.user.js'), 'utf8');
function engines(defaults = ['chromium']) {
  const playwright = require('playwright');
  const names = process.env.QL_ENGINE ? [process.env.QL_ENGINE] : defaults;
  return names.map(name => {
    if (!['chromium', 'firefox', 'webkit'].includes(name)) throw new Error('Unknown QL_ENGINE: ' + name);
    return playwright[name];
  });
}
module.exports = {source, engines};
