// node tests/d97.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d97");
const base = {
  role: "recipient", basis: "court", decision: "судебный приказ мирового судьи судебного участка № 158 от 10.03.2023 по делу № 2-500/2023",
  children: [{ name: "Петрова Анна Петровна", birth: "2018-04-10" }], cur_kind: "share", cur_share: "q14", income: 40000,
  new_kind: "fixed", new_fixed: 36742, reasons: ["needs", "hidden"], reasons_desc: "Лечение 25 000 руб. в месяц.",
  buyer_name: "Петрова Мария Сергеевна", buyer_birth: "1990-01-01", buyer_birthplace: "г. Москва", buyer_id: "СНИЛС 1", buyer_address: "г. Москва", buyer_phone: "+7 900",
  other_name: "Петров Пётр Петрович", other_address: "г. Тула", court: "Мировой судья судебного участка № 158",
};

t("увеличение: твёрдая сумма кратно ПМ по РФ (2 ПМ), без пошлины, ст. 119 и 83", () => {
  const r = run(base, {});
  assert.equal(r.d.multiple, 2); assert(!r.d.down && r.d.fee === 0);
  assert(r.text.includes("истец освобождён (пп. 2 п. 1 ст. 333.36") && r.text.includes("п. 1 ст. 119 СК РФ") && r.text.includes("п. 1 ст. 83 СК РФ"));
  assert(r.text.includes("в твёрдой денежной сумме 36 742 руб. ежемесячно, что составляет 2 величины") && r.text.includes("об увеличении размера алиментов"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d97.docx", r.a, r.d);
});

t("уменьшение: 1/4 → 1/6 от 100 000 — цена иска за год, пошлина по шкале", () => {
  const r = run(base, { role: "payer", cur_share: "q14", income: 100000, new_kind: "share", new_share: "other", new_share_other: "1/6", reasons: ["newchild"] });
  assert.equal(r.d.price, 0); // доля «другая» — сумма неизвестна
  const r2 = run(base, { role: "payer", cur_share: "q13", income: 90000, new_kind: "share", new_share: "q14", reasons: ["newchild"] });
  assert.equal(r2.d.price, 90000); assert.equal(r2.d.fee, 4000);
  assert(r2.text.includes("Цена иска: 90 000 руб.") && r2.text.includes("п. 4 ч. 1 ст. 91 ГПК РФ") && r2.text.includes("с меня в пользу ответчика"));
});

t("по соглашению — мягкое предупреждение о ст. 101", () => {
  assert(run(base, { basis: "agreement" }).stop.text.includes("ст. 101 СК"));
});

done();
