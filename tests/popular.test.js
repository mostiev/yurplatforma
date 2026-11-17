// node tests/popular.test.js — порядок по спросу, «Популярное», похожие документы
const assert = require("assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console }; ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
for (const f of ["content/catalog.js", "content/search.js", "content/popular.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx);
const { CATALOG: C, POPULAR: P } = ctx;
const live = id => { const i = C.items.find(x => x.id === id); return i && i.live; };
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok —", name); };

t("все id в спросе, «Популярном», «Смотрите также» существуют и опубликованы", () => {
  [...Object.keys(P.POP), ...P.TOP, ...Object.values(P.ALSO).flat()].forEach(id => assert(live(id), id));
  assert(P.TOP.length >= 8 && new Set(P.TOP).size === P.TOP.length);
});
t("порядок разделов покрывает все разделы каталога, каждый — один раз", () => {
  const keys = P.sections(C).map(s => s.key);
  assert.equal(keys.length, C.sections.length); assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys[keys.length - 1], "calc");
});
t("внутри раздела — по спросу: в «Работе» первой идёт объяснительная, потом увольнение и отпуск", () => {
  assert.deepEqual(P.itemsOf(C, "work").own.slice(0, 3).map(i => i.id), ["d56", "d25", "d57"]);
  assert.equal(P.itemsOf(C, "tax").own[0].id, "k6");
});
t("«Смотрите также» в разделе «Суд» — документы других разделов; похожие — без самого документа", () => {
  const also = P.itemsOf(C, "court").also.map(i => i.id);
  assert(also.includes("d36") && also.every(id => C.items.find(i => i.id === id).section !== "court"));
  const rel = P.related(C, "d25", 6);
  assert(rel.length === 6 && !rel.some(i => i.id === "d25") && rel.every(i => i.section === "work"));
});
t("быстрые ситуации: у каждой 2+ опубликованных документа, первый — главный по теме", () => {
  P.QUICK.forEach(([label, ids]) => assert(ids.length >= 2 && ids.every(live), label));
  assert.equal(P.QUICK.find(x => /Развод/.test(x[0]))[1][0], "d20");
});
t("на страницах документов есть хлебные крошки и «Ещё в разделе» (tools/seo.js)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "d", "d25.html"), "utf8");
  assert(html.includes('class="crumbs"') && html.includes("index.html#work") && html.includes("Ещё в разделе «Работа»"));
});
console.log(`\n${n} проверок пройдено`);
