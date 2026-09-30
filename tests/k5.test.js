// node tests/k5.test.js
const assert = require("assert");
const { C, run, val, t, done } = require("./_loadcalc")("k5");
const PM = C.PM.working; // 20 644

t("обычный долг с заявлением о ПМ: 50%, но не ниже ПМ", () => {
  let r = run({ income: 60000 });
  assert.equal(val(r, "Удержат"), "30 000 ₽"); assert.equal(val(r, "Останется"), "30 000 ₽");
  r = run({ income: 30000 });
  assert.equal(val(r, "Удержат"), "9 356 ₽"); assert.equal(val(r, "Останется"), "20 644 ₽");
  r = run({ kind: "pension", income: 18000 });
  assert.equal(val(r, "Удержат"), "0 ₽"); assert(r.notes.some(n => n.includes("ничего")));
  r = run({ income: 40000, region_pm: 28940 });
  assert.equal(val(r, "Удержат"), "11 060 ₽");
  assert.equal(PM, 20644);
});

t("без заявления — 50% и подсказка, сколько оставят с заявлением", () => {
  const r = run({ income: 30000, pm_app: "no" });
  assert.equal(val(r, "Удержат"), "15 000 ₽");
  assert(r.notes.some(n => n.includes("9 356 ₽") && n.includes("20 644 ₽")));
});

t("алименты: доля без долга, до 70% с долгом; вред — до 70%", () => {
  assert.equal(val(run({ income: 80000, debt: "alimony", share: "1/4", arrears: "no" }), "Удержат"), "20 000 ₽");
  const r = run({ income: 80000, debt: "alimony", share: "1/4", arrears: "yes" });
  assert.equal(val(r, "Могут удержать"), "56 000 ₽"); assert(r.notes.some(n => n.includes("ч. 3.1")));
  assert.equal(val(run({ income: 80000, debt: "alimony", share: "fixed", fixed: 15000, arrears: "no" }), "Удержат"), "15 000 ₽");
  assert.equal(val(run({ income: 50000, debt: "harm" }), "Могут удержать"), "35 000 ₽");
});

t("защищённые выплаты — 0; срок погашения долга", () => {
  const p = run({ kind: "protected" });
  assert.equal(p.summary[0].value, "0 ₽"); assert.equal(p.related[0].id, "d40");
  const r = run({ income: 60000, debt_sum: 100000 });
  assert.equal(val(r, "Долг погасится"), "4 мес.");
  assert(r.notes.some(n => n.includes("12%") && n.includes("2 000 ₽")));
});

done();
