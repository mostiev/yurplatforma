// node tests/d75.test.js — ГПХ с физлицом
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d75");
const base = Object.assign({}, spec.defaults, {
  kind: "works", subject: "Разработать логотип и брендбук", start_date: "2026-10-05", end_date: "2026-10-30", price: 100000, city: "г. Москва", doc_date: "2026-10-01",
  cl_name: "ООО «Ромашка»", cl_inn: "7701234567", cl_address: "г. Москва", cl_head_pos: "Генеральный директор", cl_head: "Петров Пётр Петрович",
  ex_name: "Иванов Иван Иванович", ex_birth: "1995-05-10", ex_passport: "45 12 345678", ex_address: "г. Тула", ex_snils: "123-456-789 00", ex_phone: "+7 900 000-00-00",
});
t("обычный человек: НДФЛ удерживает заказчик, нет признаков трудового договора, ЕФС-1 в календарь", () => {
  const r = run(base, {});
  assert(r.text.startsWith("ДОГОВОР ПОДРЯДА") && r.text.includes("налоговый агент") && r.text.includes("87 000 руб.") && r.text.includes("не подчиняется правилам внутреннего трудового распорядка"));
  assert(!/должност|график работы|отпуск/i.test(r.text.split("ФОРМА")[0].replace("не включается в штат", "")), "без признаков трудового договора");
  assert(spec.reminders(r.a, r.d).some(e => e.title.includes("ЕФС-1") && U.fmtDate(e.date) === "02.10.2026"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d75.docx", r.a, r.d);
});
t("самозанятый: чек, без НДФЛ, ИНН обязателен; бывший работник — как обычный человек", () => {
  const r = run(base, { status: "npd", ex_inn: "771234567890" });
  assert(r.text.includes("«Налог на профессиональный доход»") && r.text.includes("чек") && !r.text.includes("налоговый агент"));
  assert(allErrors(Object.assign({}, r.a, { ex_inn: undefined })).includes("ex_inn"));
  const f = run(base, { status: "npd", former: "yes", ex_inn: "771234567890" });
  assert(f.text.includes("налоговый агент"));
});
t("травматизм — только по условию договора", () => {
  assert(run(base, { travm: "yes" }).text.includes("125-ФЗ") && !run(base, {}).text.includes("125-ФЗ"));
});
done();
