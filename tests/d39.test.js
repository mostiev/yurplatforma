// node tests/d39.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d39");
const base = {
  who: "bank", what: "debt", bank: "ПАО Сбербанк", account: "40817810000000000010", doc: "Судебный приказ мирового судьи участка № 5 по делу № 2-100/2026 от 01.06.2026", creditor: "ООО ПКО «Долг»",
  group: "pension", region: "Тульская область",
  buyer_name: "Петрова Анна Ивановна", citizenship: "Российская Федерация", passport: "70 10 123456, выдан ОВД 01.01.2010", buyer_address: "г. Тула, ул. Мира, д. 3", buyer_phone: "+7 900 000-00-00",
};

t("заявление в банк: ч. 6 и 7 ст. 8, все сведения по ч. 7, документ и взыскатель", () => {
  const r = run(base, {});
  assert(r.text.startsWith("В ПАО Сбербанк") && r.text.includes("ч. 6 и 7 ст. 8") && r.text.includes("Гражданство: Российская Федерация") && r.text.includes("Паспорт: 70 10 123456"));
  assert(r.text.includes("(Судебный приказ мирового судьи участка № 5 по делу № 2-100/2026 от 01.06.2026, взыскатель — ООО ПКО «Долг»)") && r.text.includes("№ 40817810000000000010, открытом в вашем банке"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d39.docx", r.a, r.d);
});

t("пенсионер с региональным ПМ выше федерального", () => {
  assert(run(base, { region_pm: 21000 }).text.includes("для пенсионеров, — 21 000 руб."));
});

t("пристав ведёт производство — первая подсказка про Д-38; алименты — стоп", () => {
  const r = run(base, { who: "fssp" });
  assert(spec.guidance(r.a, r.d)[0].title.includes("Д-38"));
  assert(run(base, { what: "alimony" }).stop);
});

done();
