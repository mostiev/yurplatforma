// node tests/k19.test.js
const assert = require("assert");
const { run, val, t, done } = require("./_loadcalc")("k19");

t("семья из 4, доход 1 200 000 → 25 000 на человека, ПМ 17 000 × 1,5 = 25 500 — положена; выплата ≈ 7% зарплаты", () => {
  const r = run({ kids: 2, members: 4, family_income: 1200000, pm: 17000, my_income: 700000 });
  assert.equal(val(r, "Примерная выплата"), "49 000 ₽");
});

t("доход выше предела — не положена с объяснением", () => {
  const r = run({ kids: 2, members: 4, family_income: 1500000, pm: 17000, my_income: 700000 });
  assert(val(r, "Выплата") === "не положена" && r.notes[0].includes("1,5 прожиточного"));
});

t("один ребёнок и долг по алиментам — две причины", () => {
  assert.equal(run({ kids: 1, members: 3, family_income: 500000, pm: 17000, my_income: 300000, alimony: "yes" }).notes.length, 2);
});

done();
