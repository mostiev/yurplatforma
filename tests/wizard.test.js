// node tests/wizard.test.js — дерево мастера: все ветки ведут к плану, все ссылки — на живые документы каталога
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ["content/catalog.js", "content/wizard.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx);
const { CATALOG, WIZARD } = ctx;
const byId = Object.fromEntries(CATALOG.items.map(i => [i.id, i]));
let plans = 0, n = 0;
const used = new Set(), seen = new Set();
function visit(id, depth) {
  assert(WIZARD.nodes[id], "нет узла " + id);
  assert(depth < 6, "слишком глубоко: " + id);
  seen.add(id);
  const node = WIZARD.nodes[id];
  assert(node.q && node.options.length >= 2, "у узла мало вариантов: " + id);
  node.options.forEach(o => {
    assert(!!o.next !== !!o.plan, "у варианта должно быть next или plan: " + o.label);
    if (o.next) return visit(o.next, depth + 1);
    plans++;
    assert(o.plan.title && o.plan.steps.length, "пустой план: " + o.label);
    o.plan.steps.forEach(s => {
      assert(s.text, "шаг без текста");
      if (s.id) { assert(byId[s.id], `нет в каталоге: ${s.id}`); assert(byId[s.id].live, `не опубликован: ${s.id}`); used.add(s.id); }
    });
  });
}
visit(WIZARD.start, 0);
n++; console.log(`ok — ${plans} планов, все ссылки на живые документы`);
assert.deepEqual(Object.keys(WIZARD.nodes).filter(k => !seen.has(k)), []);
n++; console.log("ok — нет недостижимых узлов");
const missing = CATALOG.items.filter(i => i.live && !used.has(i.id)).map(i => i.id);
assert.deepEqual(missing, [], "документы, которых нет в мастере: " + missing.join(", "));
n++; console.log(`ok — мастер ведёт ко всем ${used.size} живым документам и калькуляторам`);
console.log(`\n${n} проверок пройдено`);
