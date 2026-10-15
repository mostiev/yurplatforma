// node tests/k16.test.js
const assert = require("assert");
const { run, val, spec, t, done } = require("./_loadcalc")("k16");

t("гибель, 3 члена семьи: страховая + пособие + указ 98, деление поровну", () => {
  const r = run({ event: "death", status: "contract", heirs: 3 });
  assert.equal(val(r, "Федеральные"), "до 14 208 154,28 ₽"); assert.equal(val(r, "На одного"), "до 4 736 051,43 ₽");
  assert(r.table.rows[0][2].includes("на каждого из 3") && r.table.rows[0][1] === "3 683 261,71 ₽" && r.notes.some(n => n.includes("приказа Минобороны № 755")));
  assert(r.related.some(x => x.id === "d87" && x.fill.kind === "end"));
});

t("гибель после выплаты за ранение — вычет; доброволец — указ 582 без суммы", () => {
  const r = run({ event: "death", heirs: 1, paid98: "heavy" });
  assert(r.table.rows[2][1].startsWith("2 000 000") && r.table.rows[2][2].includes("За вычетом"));
  const v = run({ event: "death", heirs: 1, status: "volunteer" });
  assert(v.table.rows[0][2].includes("Указ № 582") && v.table.rows[0][1] === "уточните");
});

t("инвалидность I группы при увольнении: пособие ч. 12, доплата до 4 млн, ссылка на кредиты", () => {
  const r = run({ event: "inv", inv: "1", fired: "yes", paid98: "heavy" });
  assert(r.table.rows.some(x => x[2].includes("ч. 12")) && r.table.rows.some(x => x[1].startsWith("1 000 000")));
  assert(r.related.some(x => x.id === "d87"));
  assert(!run({ event: "inv", inv: "2", fired: "no" }).table.rows.some(x => x[2].includes("ч. 12")));
});

t("ранение: тяжёлое — 3 млн + страховая; пропал без вести — шаги и Д-89", () => {
  const r = run({ event: "injury", inj: "heavy" });
  assert(r.table.rows.some(x => x[1].startsWith("3 000 000")) && r.table.rows.some(x => x[1].startsWith("368 326,16")));
  const m = run({ event: "missing" });
  assert(m.related[0].id === "d89" && m.notes.some(n => n.includes("№ 1421")));
});

done();
