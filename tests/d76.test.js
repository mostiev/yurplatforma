// node tests/d76.test.js — трудовой договор и приказ
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d76");
const base = Object.assign({}, spec.defaults, {
  position: "Менеджер по продажам", address: "г. Москва, ул. Ленина, д. 5", start_date: "2026-10-12", salary: 80000, work_time: "с 9:00 до 18:00", city: "г. Москва", doc_date: "2026-10-12", order_no: "1-к",
  em_name: "ООО «Ромашка»", em_inn: "7701234567", em_address: "г. Москва", em_head_pos: "Генеральный директор", em_head: "Петров Пётр Петрович",
  wk_name: "Сидорова Анна Петровна", wk_birth: "1998-03-15", wk_passport: "45 20 123456", wk_address: "г. Москва, ул. Мира, д. 1", wk_phone: "+7 900 000-00-00",
});
t("бессрочный, испытание 3 месяца, оклад прописью, выплаты 25 и 10, отпуск 28, приказ", () => {
  const r = run(base, {});
  assert(r.text.includes("на должность «Менеджер по продажам»") && r.text.includes("неопределённый срок") && r.text.includes("испытание сроком 3 месяца") && r.text.includes("80 000 (восемьдесят тысяч) рублей"));
  assert(r.text.includes("25-го числа") && r.text.includes("10-го числа") && r.text.includes("28 календарных дней") && r.text.includes("ст. 309.2"));
  assert(r.text.includes("ПРИКАЗ № 1-к") && r.text.includes("с испытанием на срок 3 месяца"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d76.docx", r.a, r.d);
});
t("запрет испытания: мама ребёнка до 3 лет — испытание сброшено", () => {
  const r = run(base, { no_trial: ["child3"] });
  assert.equal(r.a.trial, undefined); assert(allErrors(r.a).includes("trial"));
  assert(run(base, { no_trial: ["child3"], trial: 0 }).text.includes("без испытания"));
});
t("МРОТ, ненормированный день +3, дистанционка, срочный договор", () => {
  assert(allErrors(Object.assign({}, base, { salary: 20000 })).includes("salary"));
  assert(!allErrors(Object.assign({}, base, { salary: 20000, hours: "part", part_hours: 20 })).includes("salary"));
  assert(run(base, { irregular: "yes" }).text.includes("31 календарных дней"));
  const rem = run(base, { place: "remote", address: "г. Казань", wk_email: "anna@example.ru", em_email: "hr@romashka.ru" });
  assert(rem.text.includes("дистанционно, постоянно") && rem.text.includes("312.6") && rem.text.includes("426-ФЗ"));
  const f = run(base, { term: "fixed", fixed_basis: "small", end_date: "2027-03-31" });
  assert(f.text.includes("ч. 2 ст. 59") && f.text.includes("по 31.03.2027"));
  const short = run(base, { term: "fixed", fixed_basis: "season", end_date: "2026-11-30" });
  assert.equal(short.a.trial, undefined, "при договоре до 6 месяцев — не больше 2 недель");
});
done();
