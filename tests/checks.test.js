// «Проверь себя»: ссылки только на официальные сайты, документы из подсказок существуют и опубликованы
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = {}; ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
for (const f of ["content/catalog.js", "content/checks.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx);
const byId = Object.fromEntries(ctx.CATALOG.items.map(i => [i.id, i]));
const OFFICIAL = ["fssp.gov.ru", "bankrot.fedresurs.ru", "гибдд.рф", "www.gosuslugi.ru", "lkfl2.nalog.ru", "service.nalog.ru", "www.cbr.ru", "мвд.рф", "notariat.ru", "dom.gosuslugi.ru"];
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok —", name); };
t("10 проверок, уникальные id", () => { assert.strictEqual(ctx.CHECKS.length, 10); assert.strictEqual(new Set(ctx.CHECKS.map(c => c.id)).size, 10); });
t("ссылки — https и только официальные домены", () => ctx.CHECKS.forEach(c => c.where.forEach(w => {
  assert.ok(w.href.startsWith("https://"), w.href);
  assert.ok(OFFICIAL.includes(new URL(w.href).hostname) || OFFICIAL.includes(decodeURIComponent(new URL(w.href).hostname)) || /^https:\/\/(гибдд|мвд)\.рф/.test(w.href), w.href);
})));
t("документы в подсказках есть в каталоге и опубликованы", () => ctx.CHECKS.forEach(c => c.found.forEach(f => assert.ok(byId[f.id] && byId[f.id].live, c.id + " → " + f.id))));
t("проверки паспорта МВД нет (сервис закрыт)", () => assert.ok(!JSON.stringify(ctx.CHECKS).includes("services.fms")));
t("страница подключает данные и есть в bump", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "proverka.html"), "utf8");
  assert.ok(html.includes("content/checks.js"));
  assert.ok(fs.readFileSync(path.join(__dirname, "..", "tools/bump.js"), "utf8").includes('"proverka.html"'));
  assert.ok(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").includes('href="proverka.html"'));
});
console.log(`\n${n} проверок пройдено`);
