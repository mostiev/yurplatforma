// node tests/k4.test.js
const assert = require("assert");
const { run, val, t, done } = require("./_loadcalc")("k4");

t("срок в субботу 15.08.2026 → платить 14.08; 27 дней × 1/150 × 14%", () => {
  const r = run({ rows: "15.08.2026; 45000; 10.09.2026" });
  assert.equal(r.summary.find(s => s.big).value, "1 134 ₽");
  assert.equal(val(r, "Самая долгая"), "27");
  assert(r.notes.some(n => n.includes("ч. 8 ст. 136") && n.includes("15.08.2026")));
  assert(!val(r, "Ещё не выплачено"));
});

t("невыплаченная строка — по сегодня, ст. 142 при задержке > 15 дней", () => {
  const r = run({ rows: "15.08.2026; 45000; 10.09.2026\n30.07.2026; 38000" });
  assert.equal(val(r, "Ещё не выплачено"), "38 000 ₽");
  assert.equal(val(r, "Задержано"), "83 000 ₽");
  assert(r.notes.some(n => n.includes("ст. 142")));
  assert.equal(r.table.head.length, 5);
});

t("ошибки: плохая строка, выплата в срок", () => {
  assert(run({ rows: "август; 45000" }).error.includes("Не получилось"));
  assert(run({ rows: "14.08.2026; 45000; 12.08.2026" }).error.includes("Задержки нет"));
  assert.equal(run({}), null);
});

done();
