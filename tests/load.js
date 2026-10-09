/**
 * Loads the browser scripts in js/ into a shared VM context so DOM-free modules can be tested
 * in Node without a bundler. Returns a getter for globals defined by those scripts.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(...files) {
  const ctx = vm.createContext({ URLSearchParams });
  for (const file of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
    vm.runInContext(src, ctx, { filename: file });
  }
  return name => vm.runInContext(name, ctx);
}

/** Copy a value out of the VM realm so deepStrictEqual compares plain host objects. */
const plain = v => JSON.parse(JSON.stringify(v));

module.exports = { load, plain };
