// node tests/d82.test.js — договор купли-продажи квартиры
const assert = require("assert");
const { C, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d82");
const base = Object.assign({}, spec.defaults, {
  address: "г. Москва, ул. Ленина, д. 5, кв. 7", rooms: 2, area: 54, cadastral: "77:01:0001001:1234", own_doc: "договор купли-продажи от 10.03.2015",
  price: 15000000, paid_before: 300000, cad_value: 14000000, city: "г. Москва", doc_date: "2026-10-01", keys: 2,
  sl_name: "Иванов Иван Иванович", sl_birth: "1970-01-01", sl_passport: "45 12 345678", sl_address: "г. Москва",
  by_name: "Петров Пётр Петрович", by_birth: "1990-01-01", by_passport: "45 20 123456", by_address: "г. Тула",
});
t("ДКП: существенные условия, задаток в зачёт, аккредитив, без залога, акт, расписка, чек-лист", () => {
  const r = run(base, {});
  assert(r.text.includes("продаёт, а Покупатель покупает 2-комнатную квартиру") && r.text.includes("п. 1 ст. 558") && r.text.includes("300 000 (триста тысяч) рублей уплачены"));
  assert(r.text.includes("14 700 000 (четырнадцать миллионов семьсот тысяч) рублей — за счёт собственных средств") && r.text.includes("аккредитива") && r.text.includes("не находится в залоге"));
  assert(r.text.includes("ПЕРЕДАТОЧНЫЙ АКТ") && r.text.includes("РАСПИСКА") && r.text.includes("Чек-лист проверки квартиры") && r.text.includes("ст. 431.2"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d82.docx", r.a, r.d);
});
t("ипотека, жильцы с правом пользования, ребёнок — нотариус", () => {
  const r = run(base, { mortgage: "yes", bank: "ПАО Сбербанк", credit: 10000000, registered: "keepers", keepers: [{ name: "Иванова Мария Петровна", why: "отказ от приватизации" }], minor_owner: "yes" });
  assert(r.text.includes("за счёт кредитных средств") && r.text.includes("в залоге (ипотеке) у ПАО Сбербанк") && r.text.includes("Иванова Мария Петровна (отказ от приватизации)"));
  assert(r.text.includes("ПРОЕКТ ДЛЯ НОТАРИУСА") && r.text.includes("Разрешение органа опеки"));
});
t("пошлины: регистрация и нотариус", () => {
  assert.equal(C.regDuty(14e6), 4000); assert.equal(C.regDuty(30e6), 6000); assert.equal(C.regDuty(5e9), 500000);
  assert.equal(C.notaryDuty(15e6), 20000); assert.equal(C.notaryDuty(40000), 300);
});
done();
