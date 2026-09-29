// node tests/m05.test.js
const assert = require("assert");
const { U, run, val, t, done } = require("./_loadcalc")("m05");
const iso = d => U.iso(d);

t("оплачен по: месяц от даты выдачи; следующая оплата; график", () => {
  const issue = U.addMonths(U.today(), -2); // выдан 2 месяца назад, оплачено 3 месяца
  const r = run({ issue_date: iso(issue), monthly: 9000, months_paid: 3 });
  const until = U.addDays(U.addMonths(issue, 3), -1);
  assert.equal(val(r, "Оплачен по"), U.fmtDate(until));
  assert.equal(val(r, "Следующая оплата"), U.fmtDate(until));
  assert.equal(r.table.rows.length, 9);
  assert.equal(r.table.rows[0][1], U.fmtDate(until));
  assert.equal(r.table.rows[0][2], "9 000 ₽");
});

t("по коэффициенту: 1200 × 2,842 × 2,5 = 8 526 ₽", () => {
  const r = run({ issue_date: iso(U.addMonths(U.today(), -1)), mode: "coef", coef: 2.5, months_paid: 2 });
  assert.equal(val(r, "Платёж в месяц"), "8 526 ₽");
});

t("нужная дата: сколько месяцев доплатить; позже 12 месяцев — предупреждение", () => {
  const issue = U.addMonths(U.today(), -1);
  const r = run({ issue_date: iso(issue), monthly: 9000, months_paid: 2, target: iso(U.addMonths(issue, 5)) });
  const s = r.summary.find(x => x.label.startsWith("Оплатить ещё"));
  assert(s.label.startsWith("Оплатить ещё 4 мес.") && s.value === "36 000 ₽");
  const far = run({ issue_date: iso(issue), monthly: 9000, months_paid: 2, target: iso(U.addMonths(issue, 14)) });
  assert(far.notes.some(n => n.includes("переоформляют") && n.includes("позже")));
});

t("просрочен — прекратился; больше 12 месяцев — ошибка; пусто", () => {
  const r = run({ issue_date: iso(U.addMonths(U.today(), -4)), monthly: 9000, months_paid: 2 });
  assert.equal(r.summary.find(s => s.big).value, "прекратился");
  assert(r.notes[0].includes("п. 5 ст. 13.3") && !r.table);
  assert(run({ issue_date: "2026-01-10", monthly: 9000, months_paid: 13 }).error.includes("12 месяцев"));
  assert.equal(run({}), null);
});

done();
