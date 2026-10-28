const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {build} = require('../build.cjs');

const source = fs.readFileSync(path.join(__dirname, '../Quiet-Leaf-Firefox.user.js'), 'utf8');
assert.equal(source, build(), 'Generated userscript is stale');
new vm.Script(source);
assert.match(source, /@inject-into\s+content/);
assert.match(source, /@grant\s+none/);
assert.doesNotMatch(source, /@require\s|@connect\s|@grant\s+GM/);

// A second realm catches accidentally nested content-owned object literals.
// This models object ownership; it does not reproduce Firefox's Xray security.
const page = vm.runInNewContext('({Object})');
const adapter = fs.readFileSync(path.join(__dirname, '../adapter.js'), 'utf8');
const context = vm.createContext({window: page, CustomEvent: class {
  constructor(type, {detail}) { this.type = type; this.detail = detail; }
}});
vm.runInContext(adapter, context);
const event = vm.runInContext('firefoxBookmarkEvent(242)', context);
assert.equal(event.type, 'bookmarkSelected');
assert.equal(Object.getPrototypeOf(event.detail), page.Object.prototype);
assert.equal(Object.getPrototypeOf(event.detail.bookmark), page.Object.prototype);
assert.equal(event.detail.bookmark.id, 242);
assert.equal(event.detail.bookmark.leafNum, 242);

const read = context.firefoxPageIndex;
assert.equal(read({detail:{props:{index:10}}}), 10);
assert.equal(read({detail:{props:{firstIndex:242}}}), 242);
assert.equal(read({detail:{},wrappedJSObject:{detail:{props:{index:0}}}}), 0);
for (const index of [-1, '10', NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
  assert.equal(read({wrappedJSObject:{detail:{props:{index}}}}), null);
}
assert.equal(read({get wrappedJSObject() { throw new Error('denied'); }}), null);
assert.equal(read({}), null);
console.log('PASS Firefox packaging, cross-realm bookmark payload, inbound indexes and rejected/absent event details');
