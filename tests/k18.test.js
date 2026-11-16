// node tests/k18.test.js — пени ЖКУ
const assert = require("assert");
const { run, val, t, done } = require("./_loadcalc")("k18");

t("март 2026: срок 15.04.2026, оплата 14.08.2026 — 121 день: 60 × 1/300 + 31 × 1/130 по 9,5%", () => {
  const r = run({ debts: "03.2026; 4 850", paid: "yes", pay_date: "2026-08-14" });
  const exp = Math.round(4850 * 0.095 * (60 / 300 + 31 / 130) * 100) / 100;
  assert.equal(val(r, "Пени по закону"), exp.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽");
  assert(r.table.rows[0][2] === "до 15.04.2026" && r.table.rows[0][3] === "121");
  assert(r.notes[0].includes("9,5%"));
});

t("январь 2026 — ещё старый срок: до 10.02.2026", () => {
  assert.equal(run({ debts: "01.2026; 1000", paid: "yes", pay_date: "2026-03-01" }).table.rows[0][2], "до 10.02.2026");
});

t("первые 30 дней — без пеней", () => {
  assert.equal(val(run({ debts: "03.2026; 4850", paid: "yes", pay_date: "2026-05-15" }), "Пени по закону"), "0 ₽");
});

t("капремонт — только 1/300, без 1/130", () => {
  const r = run({ kind: "repair", debts: "03.2026; 1000", paid: "yes", pay_date: "2026-08-14" });
  const exp = Math.round(1000 * 0.095 * (91 / 300) * 100) / 100;
  assert.equal(val(r, "Пени по закону"), exp.toFixed(2).replace(".", ",") + " ₽");
});

t("срок по договору (20-е) действует только до 01.03.2026; УК насчитала больше — подсказка про ошибки", () => {
  assert.equal(run({ debts: "03.2026; 4850", paid: "yes", pay_date: "2026-08-14", due_day: 20 }).table.rows[0][2], "до 15.04.2026");
  const r = run({ debts: "12.2025; 4850", paid: "yes", pay_date: "2026-08-14", due_day: 20, billed: 900 });
  assert(r.table.rows[0][2] === "до 20.01.2026" && val(r, "УК насчитала больше на") && r.notes.some(x => x.includes("пени на пени")));
});

t("неверная строка — понятная ошибка", () => {
  assert(run({ debts: "март; 4850" }).error.includes("месяц.год"));
});

done();
