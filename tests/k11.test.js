// node tests/k11.test.js
const assert = require("assert");
const { U, C, run, val, t, done } = require("./_loadcalc")("k11");

t("1/4 от средней зарплаты, с 15 января по 31 марта, расчёт на 30 апреля", () => {
  const r = run({ from: "2026-01-15", to: "2026-03-31", avg_wage: 100000, paid: 5000 });
  // месяц 25 000; январь 17/31 = 13 709,68; долг 13 709,68 + 25 000 + 25 000 − 5 000
  assert.equal(val(r, "Начислено"), "63 709,68 ₽");
  assert.equal(val(r, "Долг"), "58 709,68 ₽");
  assert.equal(r.table.rows.length, 3);
  assert.equal(r.table.rows[0][0], "январь 2026 (17 из 31 дн.)");
  assert(r.notes.some(n => n.includes("п. 4 ст. 113")) && r.notes.some(n => n.includes("5.35.1")) && r.notes.some(n => n.includes("ст. 67")));
});

t("неустойка по каждому месяцу: 0,1% × дни", () => {
  const S = C.alimonySchedule({ from: U.date("2026-01-01"), to: U.date("2026-02-28"), perMonth: 10000, paid: 0, calc: U.date("2026-03-31") });
  assert.deepEqual(S.rows.map(r => r.late), [59, 31]);
  assert.equal(S.penalty, 590 + 310);
});

t("средняя зарплата по умолчанию — Росстат; доход известен; твёрдая сумма", () => {
  const d = run({ from: "2026-01-01", to: "2026-01-31" });
  assert.equal(val(d, "Начислено"), "28 685,75 ₽"); // 114 743 × 1/4
  const k = run({ from: "2026-01-01", to: "2026-01-31", income_mode: "known", income: 60000, share: "1/3" });
  assert.equal(val(k, "Начислено"), "20 000 ₽");
  const f = run({ kind: "fixed", fixed: 15000, from: "2026-01-01", to: "2026-02-28" });
  assert.equal(val(f, "Долг"), "30 000 ₽");
  assert(f.notes.some(n => n.includes("ст. 117")));
});

t("старше трёх лет — предупреждение о давности", () => {
  const r = run({ from: "2022-01-01", to: "2022-12-31", avg_wage: 80000 });
  assert(r.notes.some(n => n.includes("старше трёх лет")));
});

t("переплата и ошибки", () => {
  const r = run({ from: "2026-01-01", to: "2026-01-31", income_mode: "known", income: 40000, paid: 20000 });
  assert.equal(val(r, "Долг"), "0 ₽");
  assert(r.notes.some(n => n.includes("долга нет")));
  assert(run({ from: "2026-03-01", to: "2026-01-01" }).error);
  assert.equal(run({}), null);
});

done();
