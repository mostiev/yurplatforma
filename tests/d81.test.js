// node tests/d81.test.js — предварительный договор с задатком
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d81");
const base = Object.assign({}, spec.defaults, {
  address: "г. Москва, ул. Ленина, д. 5, кв. 7", rooms: 2, area: 54.3, cadastral: "77:01:0001001:1234", own_doc: "договор купли-продажи от 10.03.2015",
  price: 15000000, deposit: 300000, until: "2026-11-30", city: "г. Москва", doc_date: "2026-10-01",
  sl_name: "Иванов Иван Иванович", sl_birth: "1970-01-01", sl_passport: "45 12 345678", sl_address: "г. Москва",
  by_name: "Петров Пётр Петрович", by_birth: "1990-01-01", by_passport: "45 20 123456", by_address: "г. Тула",
});
t("задаток: двойной возврат, остаток аккредитивом, расписка, винительный падеж", () => {
  const r = run(base, {});
  assert(r.text.includes("купит 2-комнатную квартиру с кадастровым номером 77:01:0001001:1234, общей площадью 54,3 кв. м, расположенную"));
  assert(r.text.includes("задаток 300 000 (триста тысяч) рублей") && r.text.includes("в двойном размере — 600 000") && r.text.includes("14 700 000") && r.text.includes("аккредитива"));
  assert(r.text.includes("РАСПИСКА") && r.text.includes("в качестве задатка") && r.text.includes("п. 6 ст. 429"));
  assert(!r.text.includes("ПРОЕКТ ДЛЯ НОТАРИУСА"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d81.docx", r.a, r.d);
});
t("доля — проект для нотариуса; ипотека — отказ банка возвращает задаток; аванс", () => {
  const r = run(base, { shares: "share", share_size: "1/2", mortgage: "yes", bank: "ПАО Сбербанк" });
  assert(r.text.includes("ПРОЕКТ ДЛЯ НОТАРИУСА") && r.text.includes("долю в размере 1/2") && r.text.includes("отказе банка") && r.text.includes("нотариальному удостоверению"));
  assert(spec.guidance(r.a, r.d)[0].title.includes("нотариуса"));
  assert(run(base, { dep_kind: "advance" }).text.includes("не является задатком"));
});
done();
