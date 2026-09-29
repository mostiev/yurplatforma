// node tests/k2.test.js
const assert = require("assert");
const { U, run, val, t, done } = require("./_loadcalc")("k2");

t("срок 31.12.2023: 7,5% до 21.03.2024, мораторий до 31.12.2025, с 2026 — 16%; как в Д-18", () => {
  const r = run({ price: 10000000, due_date: "2023-12-31", handed: "yes", handed_date: "2026-03-01" });
  assert.deepEqual(r.table.rows.map(x => [x[0], x[1], x[2]]), [["01.01.2024–21.03.2024", "81", "7,5% / 300 × 2"], ["22.03.2024–31.12.2025", "650", "мораторий"], ["01.01.2026–01.03.2026", "60", "16% / 300 × 2"]]);
  const manual = Math.round((10000000 * 7.5 / 100 / 300 * 2 * 81 + 10000000 * 16 / 100 / 300 * 2 * 60) * 100) / 100;
  assert.equal(r.summary.find(s => s.big).value, U.money(manual).replace(/ /g, " ") + " ₽");
  assert.equal(val(r, "Из них с начислением"), "141");
  assert.equal(r.related[0].id, "d18");
});

t("организация — в одинарном размере", () => {
  const r = run({ price: 10000000, due_date: "2023-12-31", handed: "yes", handed_date: "2026-03-01", who: "org" });
  const manual = Math.round((10000000 * 7.5 / 100 / 300 * 81 + 10000000 * 16 / 100 / 300 * 60) * 100) / 100;
  assert.equal(r.summary.find(s => s.big).value, U.money(manual).replace(/ /g, " ") + " ₽");
  assert.equal(r.related.length, 0);
});

t("нет просрочки и срок до 2019 — ошибки", () => {
  assert(run({ price: 1e6, due_date: "2026-06-30", handed: "yes", handed_date: "2026-06-15" }).error.includes("Просрочки нет"));
  assert(run({ price: 1e6, due_date: "2018-06-30", handed: "yes", handed_date: "2019-06-15" }).error.includes("17.06.2019"));
});

done();
