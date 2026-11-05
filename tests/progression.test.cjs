const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function game() {
  const context = {};
  const element = () => ({getContext: () => context, style: {}, classList: {add() {}, remove() {}}, addEventListener() {}});
  const sandbox = {
    Math, performance: {now: () => 0}, localStorage: {getItem: () => null},
    document: {getElementById: element, createElement: element}
  };
  let source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  source = source.replace('  init();\n})();', `
    globalThis.game = {newSave,makeMap,canPlace,moduleClearance,
      setSave(value) { save = value; },getSave() { return save; }};
  })();`);
  vm.runInNewContext(source, sandbox);
  return sandbox.game;
}

test('engine exhaust keeps exterior cells clear of later construction', () => {
  const g = game(), save = g.newSave();
  g.setSave(save);
  assert.equal(g.canPlace('armor', 2, 3, 0), false);
  assert.equal(g.canPlace('engine', 6, 0, 0), true);
  save.modules.push({id: 5, type: 'engine', x: 6, y: 0, rotation: 0, hp: 80, level: 1});
  const clearance = g.moduleClearance(save.modules.at(-1)).map(([x,y]) => `${x},${y}`);
  assert.ok(clearance.includes('5,1'));
  assert.ok(clearance.includes('4,1'));
  assert.equal(g.canPlace('armor', 4, 0, 0), false);
});

test('sector charts stay connected and include reachable limited-stock traders', () => {
  const g = game();
  for (let i = 0; i < 30; i++) {
    const map = g.makeMap(i + 1), byId = new Map(map.nodes.map(node => [node.id, node]));
    const reached = new Set(['0-1']), queue = ['0-1'];
    for (const id of queue) for (const next of byId.get(id).links) {
      assert.ok(byId.get(next).links.includes(id));
      if (!reached.has(next)) { reached.add(next); queue.push(next); }
    }
    assert.equal(reached.size, map.nodes.length);
    assert.equal(byId.get('5-1').type, 'exit');
    assert.equal(map.version, 2);
    assert.ok(map.nodes.some(node => node.type === 'trader'));
    for (const node of map.nodes.filter(node => node.type === 'trader')) {
      assert.equal(node.stock.length, 7);
      assert.equal(new Set(node.stock.map(item => item.type)).size, 7);
      assert.ok(node.stock.every(item => item.qty > 0 && item.price > 0));
    }
  }
});
