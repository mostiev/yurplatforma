// node tests/k6.test.js
const assert = require("assert");
const { spec, run, val, t, done } = require("./_loadcalc")("k6");
const tax = spec.tax;

t("шкала НДФЛ: 2025 — прогрессия, 2024 — 13/15", () => {
  assert.equal(tax(2025, 2400000), 312000);
  assert.equal(tax(2025, 3000000), 312000 + 90000);
  assert.equal(tax(2025, 6000000), 312000 + 390000 + 180000);
  assert.equal(tax(2024, 6000000), 650000 + 150000);
  assert.equal(tax(2025, 0), 0);
});

t("лечение 200 000 при доходе 1,2 млн: лимит 150 000, вернут 19 500", () => {
  const r = run({ income: 1200000, social: 200000 });
  assert.equal(val(r, "Вычет за год"), "150 000 ₽");
  assert.equal(val(r, "Вернут за 2025"), "19 500 ₽");
  assert(r.notes.some(n => n.includes("150 000 ₽ в год")));
  assert.equal(r.table, null);
});

t("квартира 2 млн при доходе 1,2 млн: перенос на второй год, всего 260 000", () => {
  const r = run({ income: 1200000, flat: 3500000 });
  assert.equal(val(r, "Вернут за 2025"), "156 000 ₽");
  assert.equal(r.table.rows.length, 2);
  assert.deepEqual(r.table.rows[1], ["2026", "800 000 ₽", "104 000 ₽"]);
  assert.equal(val(r, "Всего вернут за 2 года"), "260 000 ₽");
  // остаток после частичного использования
  const p = run({ income: 1200000, flat: 3500000, used_flat: "part", flat_left: 500000 });
  assert.equal(val(p, "Вернут за 2025"), "65 000 ₽");
  assert.equal(run({ income: 1200000, flat: 3500000, used_flat: "full" }).error.length > 0, true);
});

t("доход 3 млн в 2025: часть вычета возвращается по 15%", () => {
  const r = run({ income: 3000000, social: 150000 });
  assert.equal(val(r, "Вернут за 2025"), "22 500 ₽");
  const r2 = run({ income: 2500000, social: 150000 });
  assert.equal(val(r2, "Вернут за 2025"), "21 500 ₽"); // 100 000 × 15% + 50 000 × 13%
  const r24 = run({ year: "2024", income: 3000000, social: 150000 });
  assert.equal(val(r24, "Вернут за 2024"), "19 500 ₽");
});

t("дети, благотворительность, дорогое лечение, ипотека", () => {
  const r = run({ income: 1000000, kids: 2, kids_study: 300000, charity: 400000, expensive: 100000 });
  // дети 220 000 + благотв. 250 000 + дорогое 100 000
  assert.equal(val(r, "Вычет за год"), "570 000 ₽");
  assert(r.notes.some(n => n.includes("110 000 ₽ на каждого")));
  const m = run({ income: 1200000, mortgage: 400000 });
  assert.equal(val(m, "Вернут за 2025"), "52 000 ₽");
  assert(m.notes.some(n => n.includes("3 000 000")));
  assert(run({ income: 500000 }).error);
  assert.equal(run({}), null);
});

t("социальные больше дохода — не переносятся", () => {
  const r = run({ income: 100000, social: 150000 });
  assert.equal(val(r, "Вернут за 2025"), "13 000 ₽");
  assert(r.notes.some(n => n.includes("не переносятся")));
  assert.equal(r.related[0].id, "d59");
});

done();
