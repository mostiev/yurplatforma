// node tests/d12.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d12");
const base = {
  role: "owner", object: "flat", address: "г. Москва, ул. Ленина, д. 5, кв. 7", rooms: 2, area: 54, ownership_doc: "Выписка из ЕГРН от 10.08.2026", owners_count: "one",
  start_date: "2026-10-01", term_months: 11, rent: 60000, pay_day: 5, pay_method: "card", deposit: 60000, utilities: "meters", pets: "no", notice_visits: 24,
  ll_name: "Иванов Иван Иванович", ll_birth: "1980-05-10", ll_passport: "45 12 345678, выдан ГУ МВД 01.02.2020", ll_address: "г. Москва, ул. Мира, д. 1", ll_phone: "+7 900 111-11-11",
  tn_name: "Петров Пётр Петрович", tn_birth: "1998-03-15", tn_passport: "45 20 123456, выдан ГУ МВД 05.06.2021", tn_address: "г. Тула, ул. Садовая, д. 2", tn_phone: "+7 900 222-22-22",
};

t("11 месяцев: срок до 31.08.2027, краткосрочный, без регистрации", () => {
  const r = run(base, {});
  assert.equal(U.fmtDate(r.d.end), "31.08.2027"); assert(r.d.short && !r.d.needsRegistration);
  assert(r.text.includes("краткосрочным") && !r.text.includes("государственной регистрации"));
  assert(r.text.includes("более двух раз"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d12-11m.docx", r.a, r.d);
});

t("2 года: регистрация по п. 2 ст. 674, три экземпляра, неоплата за шесть месяцев", () => {
  const r = run(base, { term_months: 24 });
  assert(r.d.needsRegistration && r.text.includes("п. 2 ст. 674") && r.text.includes("трёх экземплярах") && r.text.includes("за шесть месяцев"));
});

t("залог: пункты про ст. 381.1 и возврат; без залога — нет", () => {
  assert(run(base, {}).text.includes("ст. 381.1"));
  assert(!run(base, { deposit: undefined }).text.includes("381.1"));
});

t("проживающие перечислены по ст. 677", () => {
  const r = run(base, { residents: "Петрова Анна Ивановна, Петров Илья Петрович" });
  assert.equal(r.d.residents.length, 2); assert(r.text.includes("Петрова Анна Ивановна, Петров Илья Петрович") && r.text.includes("ст. 677"));
});

t("несколько собственников — согласие в приложении", () => {
  assert(run(base, { owners_count: "many" }).text.includes("Приложение № 2 — согласие сособственников"));
});

t("жилой дом и комната — правильный род", () => {
  assert(run(base, { object: "house", rooms: 4 }).text.includes("жилой дом (4 комн.), расположенный"));
  assert(run(base, { object: "room" }).text.includes("комната в квартире, расположенная"));
  assert(run(base, {}).text.includes("2-комнатная квартира, расположенная"));
});

t("день оплаты не позже 28-го", () => {
  assert(allErrors(run(base, { pay_day: 31 }).a).includes("pay_day"));
});

done();
