// node tests/search.test.js — поиск «своими словами» на главной
const assert = require("assert");
global.window = global;
require("../content/catalog.js"); require("../content/search.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok —", name); };
const top = (q, k) => SEARCH.search(CATALOG, q, k || 3).map(i => i.id);

t("у каждого живого документа есть живые формулировки", () => {
  const miss = CATALOG.items.filter(i => i.live && !SEARCH.KW[i.id]).map(i => i.id);
  assert.deepEqual(miss, []);
});
t("типичные запросы находят нужный документ в первой тройке", () => {
  const cases = { "соседи сверху затопили": "d17", "муж не платит алименты": "d23", "приставы забрали всю зарплату": "d38", "не возвращают залог за квартиру": "d14",
    "коллекторы звонят": "d42", "сына мобилизовали а у него кредит": "d87", "хочу развестись есть ребенок": "d21", "уволили по сокращению": "k10",
    "пропал без вести на сво": "d89", "перевел деньги мошенникам": "d66", "купить квартиру без риэлтора": "d82", "не платят зарплату третий месяц": "d27",
    "купил телефон на озоне а он сломался": "d06", "заблокировали карту": "d44", "штраф с камеры": "d50" };
  for (const [q, id] of Object.entries(cases)) assert(top(q).includes(id), `${q} → ${top(q)}`);
});
t("пустой и служебный запрос — пусто", () => { assert.deepEqual(top("и в на"), []); assert.deepEqual(top(""), []); });
console.log(`\n${n} проверок пройдено`);
