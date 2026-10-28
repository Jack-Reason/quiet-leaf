// Controlled desktop Gecko fixtures, not Violentmonkey or Android validation.
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {build} = require('../build.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = path.join(__dirname, '../Quiet-Leaf-Firefox.user.js');
assert.equal(fs.readFileSync(source, 'utf8'), build(), 'Generated userscript is stale');
for (const name of ['regression', 'layout', 'scroll', 'startup', 'gulag']) {
  console.log('\nDesktop Firefox fixture: ' + name);
  const result = spawnSync(process.execPath, [path.join(__dirname, '../../tests', name + '.cjs')], {
    env: {...process.env, QL_ENGINE:'firefox', QL_SOURCE:source}, stdio:'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
