// node tests/k9.test.js
const assert = require("assert");
const { U, spec, run, val, t, done } = require("./_loadcalc")("k9");

t("отпускные без исключений: 600 000 / 12 / 29,3", () => {
  const r = run({ start: "2026-11-02", days: 14, pay: 600000 });
  assert.equal(val(r, "Средний дневной"), "1 706,48 ₽"); // 600000 / 351,6
  assert.equal(val(r, "Отпускные до НДФЛ"), "23 890,72 ₽");
  assert.equal(val(r, "НДФЛ"), "3 106 ₽");
  assert.equal(val(r, "На руки"), "20 784,72 ₽");
  assert(r.notes.some(n => n.includes("30.10.2026") && n.includes("ч. 9 ст. 136")));
  assert(r.notes.some(n => n.includes("01.11.2025–31.10.2026")));
  assert.equal(r.table, null);
});

t("праздник 4 ноября продлевает отпуск", () => {
  const r = run({ start: "2026-11-02", days: 14, pay: 600000 });
  assert.equal(val(r, "Отпуск"), "02.11.2026 – 16.11.2026");
  assert(r.notes.some(n => n.includes("ст. 120")));
});

t("больничный в расчётном периоде: неполный месяц", () => {
  // больничный 10–19.03.2026 (10 дней из 31): 29,3/31×21 = 19,85 → итого 11×29,3 + 19,85 = 342,15
  const B = spec.baseDays(U.date("2026-11-02"), [[U.date("2026-03-10"), U.date("2026-03-19")]]);
  assert.equal(Math.round(B.total * 100) / 100, 342.15);
  const r = run({ start: "2026-11-02", days: 14, pay: 580000, excluded: "yes", ex1_from: "2026-03-10", ex1_to: "2026-03-19" });
  assert.equal(val(r, "Средний дневной"), "1 695,17 ₽");
  assert.equal(r.table.rows.length, 1);
});

t("компенсация при увольнении: стаж и округление по п. 35", () => {
  // принят 15.01.2025, уволен 30.09.2026: 1 год + 8 мес. 16 дн. → 9 мес.; 28 + 28/12×9 = 49; использовано 28 → 21
  const S = spec.service(U.date("2025-01-15"), U.date("2026-09-30"));
  assert.deepEqual([S.years, S.months, S.days, S.rounded], [1, 8, 16, 9]);
  const r = run({ mode: "dismissal", dism: "2026-09-30", pay: 600000, hire: "2025-01-15", annual: 28, used: 28 });
  assert.equal(val(r, "Дней компенсации"), "21");
  assert.equal(val(r, "Компенсация до НДФЛ"), "35 836,08 ₽");
  assert(r.notes.some(n => n.includes("ст. 140")));
});

t("11 месяцев — полная; сокращение с 6 месяцев — полная; иначе пропорционально", () => {
  const f = run({ mode: "dismissal", dism: "2026-09-30", pay: 600000, hire: "2025-10-20", annual: 28, used: 0 });
  assert.equal(val(f, "Дней компенсации"), "28"); // 11 мес. 11 дн. → 11
  const p = run({ mode: "dismissal", dism: "2026-09-30", pay: 600000, hire: "2026-03-20", annual: 28, used: 0 });
  assert.equal(val(p, "Дней компенсации"), "14"); // 6 мес. 11 дн. → 6 → 14
  const red = run({ mode: "dismissal", dism: "2026-09-30", pay: 600000, hire: "2026-03-20", annual: 28, used: 0, reduction: "yes" });
  assert.equal(val(red, "Дней компенсации"), "28");
  const odd = run({ mode: "dismissal", dism: "2026-09-30", pay: 600000, hire: "2026-05-01", annual: 28, used: 0 });
  assert.equal(val(odd, "Дней компенсации"), "11,67"); // 5 мес. → 28/12×5 = 11,666 → вверх
  const known = run({ mode: "dismissal", dism: "2026-09-30", pay: 600000, know_days: "yes", left_days: 7.5 });
  assert.equal(val(known, "Дней компенсации"), "7,5");
});

t("ниже МРОТ — подсказка", () => {
  const r = run({ start: "2026-11-02", days: 14, pay: 240000 });
  assert(r.notes.some(n => n.includes("МРОТ") && n.includes("27 093")));
});

done();
