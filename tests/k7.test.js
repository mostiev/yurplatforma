// node tests/k7.test.js
const assert = require("assert");
const { spec, run, val, t, done } = require("./_loadcalc")("k7");
const fee = p => spec.scale(p).fee;

t("шкала ст. 333.19 по порогам", () => {
  assert.equal(fee(50000), 4000);
  assert.equal(fee(100000), 4000);
  assert.equal(fee(200000), 7000);
  assert.equal(fee(300000), 10000);
  assert.equal(fee(400000), 12500);
  assert.equal(fee(1000000), 25000);
  assert.equal(fee(2000000), 35000);
  assert.equal(fee(5000000), 59000);
  assert.equal(fee(10000000), 87000);
  assert.equal(fee(30000000), 154000);
  assert.equal(fee(60000000), 234000);
  assert.equal(fee(500000000), 900000); // потолок
  assert.equal(fee(123457), 4704); // 4000 + 3% × 23 457 = 4 703,71 → 4 704
});

t("иск: мировой / районный, моральный вред, зачёт приказа", () => {
  let r = run({ price: 40000 });
  assert.equal(val(r, "Госпошлина"), "4 000 ₽"); assert.equal(val(r, "Куда"), "мировой судья");
  r = run({ price: 200000, moral: "yes" });
  assert.equal(val(r, "Госпошлина"), "10 000 ₽"); assert.equal(val(r, "Куда"), "районный суд");
  r = run({ price: 200000, had_order: "yes", order_paid: 3500 });
  assert.equal(val(r, "Доплатить"), "3 500 ₽");
  assert(r.notes.some(n => n.includes("70%")));
});

t("судебный приказ — 50%, мировой судья, предел 500 000", () => {
  const r = run({ kind: "order", price: 200000 });
  assert.equal(val(r, "Госпошлина"), "3 500 ₽"); assert.equal(val(r, "Куда"), "мировой судья");
  assert.equal(val(run({ kind: "order", price: 30000 }), "Госпошлина"), "2 000 ₽");
  assert(run({ kind: "order", price: 600000 }).error.includes("500 000"));
});

t("льготы: потребитель до и свыше 1 млн, трудовой спор", () => {
  let r = run({ price: 800000, benefit: "consumer", moral: "yes" });
  assert.equal(val(r, "Госпошлина"), "0 ₽"); assert.equal(val(r, "Куда"), "районный суд");
  r = run({ price: 2000000, benefit: "consumer" });
  assert.equal(val(r, "Госпошлина"), "10 000 ₽"); // 35 000 − 25 000
  assert.equal(val(run({ price: 90000, benefit: "consumer" }), "Куда"), "мировой судья");
  assert.equal(val(run({ price: 5000000, benefit: "labor" }), "Госпошлина"), "0 ₽");
  assert.equal(val(run({ kind: "nonprop", benefit: "disabled" }), "Госпошлина"), "0 ₽");
});

t("фиксированные: развод, раздел, жалобы, дубликат", () => {
  assert.equal(val(run({ kind: "divorce" }), "Госпошлина"), "5 000 ₽");
  assert.equal(val(run({ kind: "split", price: 3000000 }), "Госпошлина"), "50 000 ₽"); // 45 000 + 5 000
  assert.equal(val(run({ kind: "nonprop" }), "Госпошлина"), "3 000 ₽");
  assert.equal(val(run({ kind: "appeal" }), "Госпошлина"), "3 000 ₽");
  assert.equal(val(run({ kind: "cassation" }), "Госпошлина"), "5 000 ₽");
  assert.equal(val(run({ kind: "supreme" }), "Госпошлина"), "7 000 ₽");
  assert.equal(val(run({ kind: "duplicate" }), "Госпошлина"), "1 500 ₽");
  assert.equal(val(run({ kind: "restore" }), "Госпошлина"), "3 000 ₽");
  assert.equal(run({ kind: "claim" }), null);
});

done();
