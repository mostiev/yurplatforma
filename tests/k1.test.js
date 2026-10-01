// node tests/k1.test.js
const assert = require("assert");
const { run, val, t, done } = require("./_loadcalc")("k1");

t("возврат денег за товар: 10 дней с требования, 1% в день", () => {
  const r = run({ kind: "refund", price: 50000, demand_date: "2026-08-03", done: "yes", done_date: "2026-09-02" });
  assert.equal(val(r, "Дней просрочки"), "20");
  assert.equal(val(r, "Неустойка в день"), "500 ₽");
  assert.equal(val(r, "Неустойка"), "500 ₽"); // первая строка с этой подписью — «в день»
  assert.equal(r.summary.find(s => s.big).value, "10 000 ₽");
  assert(r.notes[1].includes("истёк 13.08.2026") && r.notes[1].includes("с 14.08.2026 по 02.09.2026"));
  assert.equal(r.related[0].id, "d01");
});

t("замена с проверкой качества: 20 дней, срок в воскресенье переносится на понедельник", () => {
  const r = run({ kind: "replace", check: "yes", price: 20000, demand_date: "2026-08-03", done: "yes", done_date: "2026-08-27" });
  assert(r.notes[1].includes("истёк 24.08.2026") && r.notes[1].includes("ст. 193"));
  assert.equal(val(r, "Дней просрочки"), "3");
});

t("предоплаченный товар: 0,5% в день, не больше предоплаты", () => {
  const r1 = run({ kind: "prepaid", price: 10000, due_date: "2026-03-02", done: "yes", done_date: "2026-09-01" });
  assert.equal(val(r1, "Дней просрочки"), "183");
  assert.equal(r1.summary.find(s => s.big).value, "9 150 ₽");
  const r2 = run({ kind: "prepaid", price: 10000, due_date: "2026-03-02", done: "yes", done_date: "2026-09-28" });
  assert.equal(r2.summary.find(s => s.big).value, "10 000 ₽");
  assert.equal(val(r2, "По дням получилось"), "10 500 ₽");
  assert(r2.summary.find(s => s.big).label.includes("предоплаты"));
});

t("работа: 3% в день, предел — цена работы", () => {
  const r = run({ kind: "work", price: 30000, due_date: "2026-09-01", done: "yes", done_date: "2026-09-05" });
  assert.equal(r.summary.find(s => s.big).value, "3 600 ₽");
  const r2 = run({ kind: "work", price: 30000, due_date: "2026-06-01", done: "yes", done_date: "2026-09-05" });
  assert.equal(r2.summary.find(s => s.big).value, "30 000 ₽");
  assert.equal(r.related[0].id, "d04");
});

t("нет просрочки — ошибка; нет данных — пусто; мораторий 2022 — предупреждение", () => {
  assert(run({ kind: "work", price: 30000, due_date: "2026-09-01", done: "yes", done_date: "2026-09-01" }).error.includes("Просрочки нет"));
  assert.equal(run({ kind: "work" }), null);
  const r = run({ kind: "refund", price: 1000, demand_date: "2022-03-01", done: "yes", done_date: "2022-05-01" });
  assert(r.notes.some(n => n.includes("ПП № 497")));
});

t("500-ФЗ: покупка с 01.02.2026 — неустойка не больше цены; до — без предела", () => {
  const after = run({ kind: "refund", price: 1000, demand_date: "2026-03-01", done: "yes", done_date: "2026-09-01" });
  assert.equal(after.summary.find(s => s.big).value, "1 000 ₽");
  assert(after.notes[0].includes("500-ФЗ"));
  const before = run({ kind: "refund", price: 1000, bought: "before", demand_date: "2026-03-01", done: "yes", done_date: "2026-09-01" });
  assert(Number(before.summary.find(s => s.big).value.replace(/\D/g, "")) > 1000);
});

done();
