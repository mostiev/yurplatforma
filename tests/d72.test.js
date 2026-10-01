// node tests/d72.test.js — NDA
const assert = require("assert");
const { spec, run, allErrors, t, done, writeDocx } = require("./_load")("d72");
const base = Object.assign({}, spec.defaults, {
  purpose: "переговоры о совместной разработке приложения", penalty: 500000, city: "г. Москва", doc_date: "2026-10-01",
  a_name: "ООО «Ромашка»", a_inn: "7701234567", a_address: "г. Москва", a_head_pos: "Генеральный директор", a_head: "Петров Пётр Петрович",
  b_kind: "person", b_name: "Иванов Иван Иванович", b_passport: "45 12 345678", b_address: "г. Тула",
});
t("одностороннее с физлицом: перечень, штраф прописью, 3 года, ст. 453", () => {
  const r = run(base, {});
  assert(r.text.includes("Сторона 1 передаёт Стороне 2") && r.text.includes("исходный код") && r.text.includes("500 000 (пятьсот тысяч) рублей") && r.text.includes("в течение 3 лет после прекращения") && r.text.includes("п. 3 ст. 453"));
  assert(r.text.includes("Иванов Иван Иванович, паспорт 45 12 345678"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d72.docx", r.a, r.d);
});
t("взаимное, режим КТ, бессрочно до огласки, без штрафа — убытки", () => {
  const r = run(base, { mutual: "both", ct_regime: "yes", years: 0, penalty: undefined });
  assert(r.text.includes("Стороны передают друг другу") && r.text.includes("98-ФЗ") && r.text.includes("до момента, когда информация станет общедоступной") && r.text.includes("ст. 393"));
});
done();
