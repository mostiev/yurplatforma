// node tests/handoff.test.js — перенос данных из калькулятора в документ: поля есть в документе, значения подходят
const assert = require("assert");
const loadCalc = require("./_loadcalc");
const loadDoc = require("./_load");
const docs = {};
const doc = id => docs[id] || (docs[id] = loadDoc(id));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok —", name); };
const check = (calcId, a, docId, expect) => {
  const c = loadCalc(calcId);
  const r = c.run(a);
  const rel = (r.related || []).find(x => x.id === docId && x.fill);
  assert(rel, `${calcId}: нет перехода в ${docId} с данными`);
  const fill = Object.fromEntries(Object.entries(rel.fill).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const D = doc(docId);
  const ids = new Set(D.spec.steps.flatMap(s => s.questions.map(q => q.id)));
  Object.keys(fill).forEach(k => assert(ids.has(k), `${calcId} → ${docId}: в документе нет поля ${k}`));
  // документ принимает значения: проверяем валидацией движка
  const res = D.run(fill);
  Object.keys(fill).forEach(k => {
    const q = D.spec.steps.flatMap(s => s.questions).find(x => x.id === k && (!x.show || x.show(res.a, res.d)));
    if (q) assert.equal(D.Engine ? D.Engine.validateQuestion(q, res.a, res.d) : null, null, `${docId}.${k} не принимает ${fill[k]}`);
  });
  if (expect) assert.deepEqual(fill, expect);
};
t("К-2 → Д-18: цена, срок, акт", () => check("k2", { price: 8000000, due_date: "2025-12-31", handed: "yes", handed_date: "2026-05-01", who: "person" }, "d18", { price: 8000000, due_date: "2025-12-31", handed: "yes", handed_date: "2026-05-01" }));
t("К-3 → Д-35 и Д-32: сумма и срок", () => { check("k3", { amount: 100000, due_date: "2026-01-10" }, "d35", { amount: 100000, term: "date", due_date: "2026-01-10" }); check("k3", { amount: 100000, due_date: "2026-01-10" }, "d32"); });
t("К-1 → Д-01: цена и требование", () => check("k1", { kind: "refund", price: 50000, demand_date: "2026-09-01" }, "d01", { price: 50000, demand: "refund" }));
t("К-7 → Д-60 и Д-35", () => { check("k7", { kind: "claim", price: 200000 }, "d60", { what: "money", sum: 200000 }); check("k7", { kind: "order", price: 50000 }, "d35", { amount: 50000 }); });
t("К-8 → Д-61, после срока ещё и Д-84", () => { check("k8", { death_date: "2026-09-01" }, "d61", { death_date: "2026-09-01" }); check("k8", { death_date: "2025-01-10" }, "d84", { death_date: "2025-01-10" }); });
t("К-9 → Д-57: отпуск", () => check("k9", { mode: "vacation", start: "2026-11-02", days: 14, pay: 100000 }, "d57", { kind: "annual", start_date: "2026-11-02", days: 14 }));
t("К-13 → Д-12, К-15 → Д-82", () => { check("k13", { rent: 50000, months: 12 }, "d12", { rent: 50000 }); check("k15", { price: 9000000, cad: 7000000 }, "d82", { price: 9000000, cad_value: 7000000 }); });
t("К-16 → Д-87: прекращение долга при гибели", () => check("k16", { event: "death", heirs: 2 }, "d87", { kind: "end", death_kind: "died" }));
// цепочки документов: spec.next(a, d) — поля есть в следующем документе и проходят его проверку
t("цепочки документов (spec.next): поля и значения подходят следующему документу", () => {
  const BASES = { d62: "k11" };
  const fake = q => q.type === "money" || q.type === "number" ? 10000 : q.type === "date" ? "2026-01-10" : q.type === "multi" ? [q.options[0].value] : q.options ? undefined : q.type === "email" ? "a@b.ru" : q.type === "tel" ? "+7 900 000-00-00" : "Тест";
  let checked = 0;
  for (const id of ["d01", "d04", "d35", "d27", "d23", "d51", "d60", "d65"]) {
    const S = doc(id);
    const a = Object.assign({}, S.spec.defaults || {});
    S.spec.steps.flatMap(s => s.questions).forEach(q => { if (a[q.id] === undefined) { const v = fake(q); if (v !== undefined) a[q.id] = v; else if (q.options) a[q.id] = q.options[0].value; } });
    const r = S.run(a);
    const nx = (S.spec.next(r.a, r.d) || []).filter(x => x && x.fill);
    assert(nx.length, `${id}: нет шагов с данными`);
    for (const x of nx) {
      const T = docs[x.id + "|"] || (docs[x.id + "|"] = loadDoc(x.id, BASES[x.id]));
      const ids = new Set(T.spec.steps.flatMap(s => s.questions.map(q => q.id)));
      const fill = Object.fromEntries(Object.entries(x.fill).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)));
      Object.keys(fill).forEach(k => assert(ids.has(k), `${id} → ${x.id}: нет поля ${k}`));
      const res = T.run(fill);
      Object.keys(fill).forEach(k => {
        const q = T.spec.steps.flatMap(s => s.questions).find(z => z.id === k && (!z.show || z.show(res.a, res.d)));
        if (q) assert.equal(T.Engine.validateQuestion(q, res.a, res.d), null, `${id} → ${x.id}.${k} = ${JSON.stringify(fill[k])}`);
      });
      checked++;
    }
  }
  assert(checked >= 9);
});
console.log(`\n${n} проверок пройдено`);
