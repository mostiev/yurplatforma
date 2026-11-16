// node tests/d96.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d96");
const base = {
  mode: "agree", marriage_date: "2015-06-20", divorce_date: "2025-03-01",
  assets: [{ what: "квартира по адресу: г. Москва, ул. Ленина, д. 5, кв. 10", value: 12000000, to: "me" }, { what: "автомобиль Kia Rio, VIN XWE…", value: 1200000, to: "them" }, { what: "вклад в ПАО «Банк»", value: 800000, to: "them" }],
  debts: [{ what: "ипотека в ПАО «Банк»", value: 3000000, to: "me" }],
  buyer_name: "Петров Пётр Петрович", buyer_birth: "1988-01-01", buyer_id: "паспорт 4510 123456", buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 10",
  other_name: "Петрова Мария Сергеевна", other_address: "г. Москва, ул. Тверская, д. 1",
};

t("соглашение: проект для нотариуса, список, кому что, компенсация 5 000 000", () => {
  const r = run(base, {});
  assert.equal(r.d.total, 14000000); assert.equal(r.d.comp, 5000000);
  assert(r.text.startsWith("ПРОЕКТ — для нотариального удостоверения") && r.text.includes("1) квартира по адресу"));
  assert(r.text.includes("Плательщик — Петров Пётр Петрович, получатель — Петрова Мария Сергеевна"));
  assert(r.text.includes("ст. 391 ГК РФ"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d96.docx", r.a, r.d);
});

t("иск: цена — половина, пошлина по шкале, недвижимость — ст. 30 ГПК, компенсация ответчику", () => {
  const r = run(base, { mode: "court", buyer_birthplace: "г. Москва", buyer_id: "СНИЛС 1", buyer_phone: "+7 900", court: "Хамовнический районный суд г. Москвы" });
  assert.equal(r.d.price, 7000000);
  assert(r.text.includes("Цена иска: 7 000 000 руб.") && r.text.includes("ч. 1 ст. 30 ГПК РФ") && r.text.includes("Определить компенсацию, причитающуюся ответчику, в размере 5 000 000 руб."));
  assert(r.text.includes("п. 3 ст. 39 СК РФ") && !r.stop);
});

t("развод больше 3 лет назад — мягкое предупреждение о давности", () => {
  const r = run(base, { mode: "court", divorce_date: "2020-01-01", buyer_birthplace: "М", buyer_id: "С", buyer_phone: "1", court: "Суд" });
  assert(r.stop && r.stop.soft && r.stop.text.includes("п. 7 ст. 38 СК"));
});

done();
