// Загружает движок и документ в песочницу node для тестов
const fs = require("fs");
const path = require("path");
const vm = require("vm");
module.exports = function load(id) {
  const ctx = { TextEncoder, console, Date };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ["assets/docx.js", "assets/engine.js", "assets/keyrate.js", "assets/common.js", `content/${id}.js`]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
  }
  const { Engine, DOCS, Docx } = ctx;
  const spec = DOCS[id];
  const run = (base, over) => {
    const a = Object.assign({}, base, over);
    Engine.prune(spec, a);
    const d = spec.derive(a);
    // неразрывные пробелы в суммах заменяем обычными, чтобы проверки читались проще
    const text = Engine.paragraphsToText(spec.render(a, d)).replace(/ /g, " ");
    return { a, d, text, stop: spec.stop ? spec.stop(a, d) : null };
  };
  const allErrors = a => spec.steps.flatMap(s => Object.keys(Engine.stepErrors(spec, s, a)));
  let n = 0;
  const t = (name, fn) => { fn(); n++; console.log("ok —", name); };
  const done = () => console.log(`\n${n} проверок пройдено`);
  const writeDocx = (name, a, d) => {
    fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "out", name), Docx.buildDocx(spec.render(a, d)));
  };
  return { Engine, spec, U: Engine.U, run, allErrors, t, done, writeDocx };
};
