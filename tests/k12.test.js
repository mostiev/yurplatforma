// node tests/k12.test.js
const assert = require("assert");
const { run, val, t, done } = require("./_loadcalc")("k12");

t("квартира куплена 3 года назад, не единственная: 5 лет — налог", () => {
  const r = run({ owned_from: "2023-03-01", sale_date: "2026-10-15", price: 9000000, spent: 7000000 });
  assert.equal(val(r, "Минимальный срок"), "5 лет");
  assert.equal(val(r, "Налог"), "260 000 ₽"); // (9 000 000 − 7 000 000) × 13%
  assert(r.notes.some(n => n.includes("01.03.2028")) && r.notes.some(n => n.includes("30.04.2027") && n.includes("15.07.2027")));
});

t("единственное жильё — 3 года; наследство — 3 года; прошло — 0", () => {
  const r = run({ owned_from: "2023-03-01", sale_date: "2026-10-15", price: 9000000, only_home: "yes" });
  assert.equal(val(r, "Налог"), "0 ₽");
  assert(run({ how: "inherit", owned_from: "2023-01-10", sale_date: "2026-10-15", price: 5000000 }).notes.some(n => n.includes("не облагается")));
});

t("70% кадастровой и стандартный вычет 1 млн", () => {
  const r = run({ owned_from: "2024-05-01", sale_date: "2026-10-15", price: 3000000, cadastral: 6000000 });
  assert.equal(val(r, "Доход для налога"), "4 200 000 ₽");
  assert.equal(val(r, "Налог"), "432 000 ₽"); // база 3,2 млн: 312 000 + 800 000 × 15%
  assert(r.notes.some(n => n.includes("15%")));
});

t("машина: меньше 3 лет, продал дешевле покупки — 0, но декларация", () => {
  const r = run({ kind: "movable", owned_from: "2025-02-01", sale_date: "2026-10-15", price: 1200000, spent: 1500000 });
  assert.equal(val(r, "Налог"), "0 ₽");
  assert(r.notes.some(n => n.includes("Декларация нужна, даже если налог выйдет 0")));
  const s = run({ kind: "movable", owned_from: "2025-02-01", sale_date: "2026-10-15", price: 200000 });
  assert(s.notes.some(n => n.includes("можно не подавать")));
});

t("семья с детьми — условия п. 2.1", () => {
  const r = run({ owned_from: "2025-03-01", sale_date: "2026-10-15", price: 9000000, family: "yes" });
  assert(r.notes.some(n => n.includes("п. 2.1 ст. 217.1")) && r.notes.some(n => n.includes("30.04.2027")));
});

done();
