// node tests/d69.test.js — договор поставки
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d69");
const base = Object.assign({}, spec.defaults, {
  goods: [{ name: "Кофемашина Jura E8", qty: 2, unit: "шт.", price: 150000 }, { name: "Фильтр", qty: 10, price: 2000 }],
  address: "г. Москва, ул. Ленина, д. 5", deliver_date: "2026-10-20",
  sp_name: "ООО «Поставка»", sp_inn: "7701234567", sp_address: "г. Москва, ул. Складская, д. 10", sp_head_pos: "Директор", sp_head: "Сидоров Сидор Сидорович",
  by_name: "ООО «Кофейня»", by_inn: "7707654321", by_address: "г. Москва, ул. Ленина, д. 5", by_head_pos: "Генеральный директор", by_head: "Петров Пётр Петрович",
  city: "г. Москва", doc_date: "2026-10-01",
});

t("разовая поставка: спецификация, итог, предоплата 50%", () => {
  const r = run(base, {});
  assert.equal(r.d.total, 320000); assert.equal(r.d.prepay, 160000);
  assert(r.text.includes("СПЕЦИФИКАЦИЯ") && r.text.includes("1 | Кофемашина Jura E8 | 2 | шт. | 150 000 | 300 000") && r.text.includes("Итого: 320 000 руб."));
  assert(r.text.includes("160 000 (сто шестьдесят тысяч) рублей") && r.text.includes("не находится (п. 5 ст. 488"));
  assert(r.text.includes("ст. 514 ГК") && r.text.includes("ст. 523 ГК"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d69-once.docx", r.a, r.d);
});

t("рамочный без товара: заявки, автопродление; товар необязателен", () => {
  const r = run(base, { mode: "frame", goods: undefined, order_days: 5, end_date: "2026-12-31", payment: "defer", defer_days: 30, title: "payment", vat: "22" });
  assert.deepEqual(allErrors(r.a), []);
  assert(r.text.includes("по заявкам Покупателя") && r.text.includes("продлевается на каждый следующий год") && r.text.includes("НДС по ставке 22%"));
  assert(r.text.includes("после его полной оплаты (ст. 491") && !r.text.includes("СПЕЦИФИКАЦИЯ"));
  assert(allErrors(Object.assign({}, base, { goods: undefined })).includes("goods"), "в разовой поставке товар обязателен");
});

t("самовывоз и отсрочка", () => {
  const r = run(base, { delivery: "pickup", payment: "defer", defer_days: 14 });
  assert(r.text.includes("забирает товар со склада") && r.text.includes("в течение 14 календарных дней со дня поставки"));
  assert(spec.reminders(r.a, r.d).some(e => U.fmtDate(e.date) === "03.11.2026"));
});

done();
