// node tests/k13.test.js — налог с аренды квартиры
const assert = require("assert");
const { run, val, spec, t } = require("./_loadcalc")("k13");
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("ok —", name); };

ok("60 000 ₽ × 12, зарплата 1 млн: НПД 4% с вычетом 7 200 ₽ → 21 600 ₽, НДФЛ 13% = 93 600 ₽", () => {
  const r = run({ rent: 60000, salary: 1000000 });
  assert.equal(val(r, "Доход"), "720 000 ₽");
  assert.equal(val(r, "Самозанятость"), "21 600 ₽");
  assert.equal(val(r, "НДФЛ"), "93 600 ₽");
  assert.equal(val(r, "Экономия на самозанятости"), "72 000 ₽");
  assert.ok(r.reminders.length === 12 && r.reminders[0].title.includes("самозанятого"));
});

ok("вычет уже потрачен — 4% полностью", () => assert.equal(val(run({ rent: 60000, bonus: "used" }), "Самозанятость"), "28 800 ₽"));

ok("большая зарплата: доход от аренды попадает под 15% и 18%", () => {
  // зарплата 4,8 млн + 720 тыс.: 200 тыс. по 15%, 520 тыс. по 18%
  const r = run({ rent: 60000, salary: 4800000 });
  assert.equal(val(r, "НДФЛ"), String(Math.round(200000 * 0.15 + 520000 * 0.18)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽");
});

ok("компания: 6% и вычет 2%; работодатель — самозанятость недоступна", () => {
  assert.equal(val(run({ rent: 100000, tenant: "company" }), "Самозанятость"), "62 000 ₽");
  const r = run({ rent: 100000, tenant: "company", employer: "yes" });
  assert.equal(val(r, "Самозанятость"), "недоступна");
  assert.ok(r.notes[0].includes("работодателя"));
});

ok("лимит 2,4 млн: аренда + другие доходы самозанятого", () => {
  const r = run({ rent: 150000, npd_other: 700000 });
  assert.equal(val(r, "Самозанятость"), "недоступна");
  assert.ok(r.reminders.some(e => e.title.includes("3-НДФЛ")));
});

console.log(`\n${n} проверок пройдено`);
