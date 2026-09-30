// node tests/k10.test.js
const assert = require("assert");
const { spec, run, val, t, done } = require("./_loadcalc")("k10");
const row = (r, s) => r.table.rows.find(x => x[0].startsWith(s));

t("среднее число рабочих дней: 2025 и 2026 — 20,58", () => {
  assert.equal(spec.monthAvg(2025), 20.58);
  assert.equal(spec.monthAvg(2026), 20.58);
});

t("сокращение 30.11.2026: период 11.2025–10.2026, по календарю", () => {
  // рабочих дней 01.11.2025–31.10.2026 по календарю — 246, минус 20 отпуск = 226
  const r = run({ dism: "2026-11-30", pay: 900000, absent: 20 });
  assert(r.notes.some(n => n.includes("по производственному календарю — 246")));
  // 900 000 / 226 = 3 982,30; × 20,58 = 81 955,73
  assert.equal(val(r, "Средний месячный"), "81 955,73 ₽");
  assert.equal(val(r, "В день увольнения"), "81 955,73 ₽");
  assert.equal(val(r, "Всего"), "до 245 867,19 ₽");
  assert(r.notes.some(n => n.includes("14 рабочих дней")) && r.notes.some(n => n.includes("245 867,19 ₽")));
});

t("досрочное увольнение: компенсация по ст. 180", () => {
  // предупредили 01.10.2026 → срок 01.12.2026; уволили 13.11.2026 → раб. дни 16.11–01.12 = 12
  const r = run({ dism: "2026-11-13", notice: "2026-10-01", pay: 900000, days_mode: "manual", worked: 225 });
  assert.equal(row(r, "Компенсация за досрочное")[2], "48 000 ₽"); // 4000 × 12
  assert.equal(val(r, "В день увольнения"), "130 320 ₽"); // 82 320 + 48 000
});

t("Крайний Север — до 6 месяцев", () => {
  const r = run({ dism: "2026-11-30", pay: 900000, days_mode: "manual", worked: 225, north: "yes" });
  assert(row(r, "4–6-й") && val(r, "Всего").startsWith("до "));
  assert(r.notes.some(n => n.includes("ст. 318")));
});

t("две недели при других основаниях", () => {
  const r = run({ reason: "two_weeks", dism: "2026-11-30", pay: 900000, days_mode: "manual", worked: 225 });
  // 4000 × 10 рабочих дней (01.12–14.12.2026)
  assert.equal(val(r, "Выходное пособие"), "40 000 ₽");
});

done();
