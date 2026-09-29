// node tests/k4.test.js
const assert = require("assert");
const { run, val, t, done } = require("./_loadcalc")("k4");

t("срок в субботу 15.08.2026 → платить 14.08; 27 дней × 1/150 × 14%", () => {
  const r = run({ due1: "2026-08-15", amount1: 45000, paid1: "yes", paid_date1: "2026-09-10" });
  assert.equal(r.summary.find(s => s.big).value, "1 134 ₽");
  assert.equal(val(r, "Самая долгая"), "27");
  assert(r.notes.some(n => n.includes("ч. 8 ст. 136") && n.includes("15.08.2026")));
  assert(!val(r, "Ещё не выплачено"));
});

t("вторая выплата видна только после «есть ещё»; невыплаченная — по сегодня, ст. 142", () => {
  const one = run({ due1: "2026-08-15", amount1: 45000, paid1: "yes", paid_date1: "2026-09-10", due2: "2026-07-30", amount2: 38000 });
  assert.equal(val(one, "Задержано"), "45 000 ₽", "без more1 вторая строка не учитывается");
  const r = run({ due1: "2026-08-15", amount1: 45000, paid1: "yes", paid_date1: "2026-09-10", more1: "yes", due2: "2026-07-30", amount2: 38000 });
  assert.equal(val(r, "Ещё не выплачено"), "38 000 ₽");
  assert.equal(val(r, "Задержано"), "83 000 ₽");
  assert(r.notes.some(n => n.includes("ст. 142")));
  assert.equal(r.table.head.length, 5);
});

t("незаполненная выплата не ломает расчёт; выплата в срок; пусто", () => {
  const r = run({ due1: "2026-08-15", amount1: 45000, paid1: "yes", paid_date1: "2026-09-10", more1: "yes", due2: "2026-07-30" });
  assert(r.notes[0].includes("Выплата 2 заполнена не до конца"));
  assert(run({ due1: "2026-08-14", amount1: 45000, paid1: "yes", paid_date1: "2026-08-12" }).error.includes("Задержки нет"));
  assert.equal(run({}), null);
  assert.equal(run({ due1: "2026-08-14", amount1: 45000, paid1: "yes" }), null, "дата выплаты не указана");
});

done();
