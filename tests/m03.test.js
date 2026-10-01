// node tests/m03.test.js — вариант Д-12 для нанимателя-иностранца
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("m03", "d12");
const base = Object.assign({}, spec.defaults, {
  role: "owner", object: "flat", address: "г. Тула, ул. Ленина, д. 5, кв. 7", rooms: 2, area: 54, ownership_doc: "Выписка из ЕГРН от 10.08.2026", owners_count: "one",
  start_date: "2026-10-01", term_months: 11, rent: 30000, pay_day: 5, pay_method: "card", deposit: 30000, utilities: "meters", pets: "no", notice_visits: 24,
  ll_name: "Иванов Иван Иванович", ll_birth: "1980-05-10", ll_passport: "70 12 345678, выдан УМВД 01.02.2020", ll_address: "г. Тула, ул. Мира, д. 1", ll_phone: "+7 900 111-11-11",
  tn_foreign: "yes", tn_citizenship: "Республика Узбекистан", tn_name: "Каримов Азиз Рустамович", tn_birth: "1995-03-12", tn_passport: "FA 1234567, выдан МВД Республики Узбекистан 01.02.2022",
  tn_address: "Республика Узбекистан, г. Самарканд, ул. Навои, д. 12", tn_phone: "+7 900 222-22-22", tn_moscow: "no",
});

t("вариант: свой код и заголовок, иностранец выбран заранее", () => {
  assert.equal(spec.id, "m03"); assert.equal(spec.code, "М-03"); assert.equal(spec.defaults.tn_foreign, "yes"); assert.equal(spec.defaults.term_months, 11);
});

t("иностранец: гражданство, адрес за рубежом, пункты о миграционном учёте в конце раздела 5", () => {
  const r = run(base, {});
  assert(r.text.includes("гражданин(ка) Республика Узбекистан, паспорт FA 1234567") && r.text.includes("адрес постоянного проживания: Республика Узбекистан"));
  assert(!r.text.includes("зарегистрированный(ая) по адресу: Республика"));
  const i6 = r.text.indexOf("5.7. Наниматель возмещает ущерб"), i7 = r.text.indexOf("5.8. Наниматель является иностранным"), i8 = r.text.indexOf("5.9. Наниматель обязан в день вселения");
  assert(i6 > 0 && i7 > i6 && i8 > i7);
  assert(!r.text.includes("регистрацию Нанимателя и проживающих"), "для иностранца — миграционный учёт, не регистрация по месту пребывания");
  assert(r.text.includes("в течение 7 рабочих дней со дня прибытия") && r.text.includes("№ 109-ФЗ") && r.text.includes("миграционную карту"));
  const g = spec.guidance(r.a, r.d);
  assert(g[0].title.includes("7 рабочих дней") && g.some(x => x.text.includes("ст. 322.3")) && !g.some(x => x.text.includes("121-ФЗ")));
  assert(spec.guidance(Object.assign({}, r.a, { tn_moscow: "yes" }), r.d).some(x => x.text.includes("121-ФЗ")));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("m03.docx", r.a, r.d);
});

t("гражданин России — прежний текст без миграционных пунктов", () => {
  const r = run(base, { tn_foreign: "no", tn_passport: "45 20 123456", tn_address: "г. Тула, ул. Садовая, д. 2" });
  assert(r.text.includes("зарегистрированный(ая) по адресу: г. Тула, ул. Садовая") && !r.text.includes("иностранным гражданином") && r.a.tn_citizenship === undefined);
});

done();
