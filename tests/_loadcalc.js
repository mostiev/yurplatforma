// Загружает движок и калькулятор в песочницу node для тестов: compute() — чистая функция
const fs = require("fs");
const path = require("path");
const vm = require("vm");
module.exports = function load(id) {
  const ctx = { TextEncoder, console, Date };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ["assets/engine.js", "assets/keyrate.js", "assets/calendar.js", "assets/common.js", `content/${id}.js`]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
  }
  const { Engine, CALCS, Common } = ctx;
  const spec = CALCS[id];
  const nb = s => String(s).replace(/ /g, " ");
  // результат с нормализованными пробелами; val(r, "Подпись") — значение строки итога
  const run = a => { const r = spec.compute(Object.assign({}, spec.defaults || {}, a)); return r && JSON.parse(nb(JSON.stringify(r))); };
  const val = (r, label) => { const s = (r.summary || []).find(x => x.label.startsWith(label)); return s ? s.value : undefined; };
  let n = 0;
  const t = (name, fn) => { fn(); n++; console.log("ok —", name); };
  const done = () => console.log(`\n${n} проверок пройдено`);
  return { Engine, U: Engine.U, C: Common, spec, run, val, t, done };
};
