// node tests/k14.test.js — выбор налогового режима ИП
const assert = require("assert");
const { run, val } = require("./_loadcalc")("k14");
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("ok —", name); };

ok("1,5 млн, без работников: самозанятость 60 000, УСН 6% = 90 000 (налог уменьшен на взносы)", () => {
  const r = run({ rev: 1500000, exp: 300000 });
  assert.equal(val(r, "Самозанятость"), "60 000 ₽");
  assert.equal(val(r, "УСН «доходы» 6%"), "90 000 ₽");
  assert.equal(val(r, "АУСН"), "120 000 ₽");
  assert.equal(r.summary.find(s => s.big).label, "Самозанятость (4%)");
});

ok("5 млн, работники: самозанятость недоступна, УСН 6% — уменьшение не больше 50%", () => {
  const r = run({ rev: 5000000, exp: 1000000, employees: 2, payroll: 1200000 });
  assert(r.table.rows.find(x => x[0].startsWith("Самозанятость")).at(-1).includes("недоступен"));
  // налог 300 000; взносы ИП 57 390 + 47 000 = 104 390; за работников 360 000; уменьшение — не больше 150 000
  assert.equal(val(r, "УСН «доходы» 6%"), "614 390 ₽"); // 150 000 + 104 390 + 360 000
});

ok("30 млн: НДС 5% на УСН, АУСН и патент без НДС", () => {
  const r = run({ rev: 30000000, exp: 20000000, ausn: "yes", patent: 600000, npd_ok: "no" });
  const usn = r.table.rows.find(x => x[0].startsWith("УСН «доходы» 6%"));
  assert(r.table.head.includes("НДС") && usn[r.table.head.indexOf("НДС")] !== "—");
  assert(r.notes.some(x => x.includes("НДС 5%")));
  assert(r.table.rows.find(x => x[0] === "Патент").at(-1).includes("недоступен"), "патент — до 20 млн");
});

ok("минимальный налог 1% на УСН 15% при убытке", () => {
  const r = run({ rev: 2000000, exp: 2500000 });
  assert(r.notes.some(x => x.includes("минимальный налог 1%")));
});

console.log(`\n${n} проверок пройдено`);
