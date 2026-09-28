// node tests/d43.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d43");
const base = {
  court: "Хамовнический районный суд г. Москвы", case_no: "2-1234/2026", decision_date: "2026-08-20", plaintiff: "ООО ПКО «Долговой центр»", claim: "взыскана задолженность по кредитному договору 184 300 руб.",
  got_date: U.iso(U.addDays(U.today(), -2)), absence: "elsewhere", absence_desc: "С 01.03.2026 живу в г. Казани",
  merits: ["limitation", "penalty"], merits_desc: "Последний платёж был 10.01.2021.", proofs: "Копия договора аренды в г. Казани",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Казань, ул. Баумана, д. 1", buyer_phone: "+7 900 000-00-00",
};

t("в срок: причина неявки, доводы по ст. 199 и 333, ст. 242, отменить и возобновить; копия для истца", () => {
  const r = run(base, {});
  assert(r.text.includes("Ответчик: Петров Пётр Петрович") && r.text.includes("Истец: ООО ПКО «Долговой центр»\nДело № 2-1234/2026"));
  assert(r.text.includes("не проживал(а) по адресу") && r.text.includes("живу в г. Казани.") && r.text.includes("ст. 199 ГК РФ") && r.text.includes("ст. 333 ГК РФ") && r.text.includes("Последний платёж был 10.01.2021."));
  assert(r.text.includes("1. Отменить заочное решение от 20.08.2026 по делу № 2-1234/2026."));
  assert(r.text.includes("2. Возобновить рассмотрение дела по существу") && r.text.includes("Копия заявления для истца.") && !r.text.includes("Восстановить срок"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d43.docx", r.a, r.d);
});

t("7 рабочих дней: получил 29.10.2026 → до 10.11.2026 (4 ноября — праздник)", () => {
  assert.equal(U.fmtDate(run(base, { got_date: "2026-10-29" }).d.deadline), "10.11.2026");
});

t("срок пропущен — причина и просьба восстановить по ст. 112", () => {
  const r = run(base, { got_date: "2026-08-25", late_reason: "был(а) в больнице" });
  assert(r.d.late && r.text.includes("1. Восстановить срок") && r.text.includes("пропущен по уважительной причине: был(а) в больнице"));
});

t("«другое» без описания — ошибка; только «другое» с описанием — ок", () => {
  assert(allErrors(run(base, { merits: ["other"], merits_desc: undefined }).a).includes("merits_desc"));
  assert.deepEqual(allErrors(run(base, { merits: ["other"], merits_desc: "Сумма уже взыскана по другому делу" }).a), []);
});

done();
