// node tests/k15.test.js — расходы на сделку с квартирой
const assert = require("assert");
const { run, val } = require("./_loadcalc")("k15");
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("ok —", name); };
ok("15 млн, без нотариуса: 4 000 + выписки; вычет 260 000", () => {
  const r = run({ price: 15000000, cad: 14000000 });
  assert.equal(val(r, "Пошлина за регистрацию"), "4 000 ₽"); assert.equal(val(r, "Итого"), "5 160 ₽"); assert.equal(val(r, "Вычет"), "до 260 000 ₽");
});
ok("доля: нотариус 0,5% не больше 20 000", () => assert.equal(val(run({ price: 6000000, what: "share" }), "Нотариус"), "20 000 ₽"));
ok("по желанию, родственник: 3 000 + 0,2%", () => assert.equal(val(run({ price: 5000000, notary: "yes", close: "yes" }), "Нотариус"), "13 000 ₽"));
ok("кадастровая больше 20 млн — 0,02%", () => assert.equal(val(run({ price: 30000000, cad: 25000000 }), "Пошлина за регистрацию"), "5 000 ₽"));
console.log(`\n${n} проверок пройдено`);
