// node tests/d36.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d36");
const base = {
  court: "Мировой судья судебного участка № 123 района Хамовники г. Москвы", case_no: "2-1234/2026", order_date: "2026-09-01",
  creditor: "ООО ПКО «Долговой центр»", sum: 85400.5, got_how: "copy", got_date: U.iso(U.addDays(U.today(), -3)), withheld: "no",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("в срок: без причин, просьба отменить приказ, ст. 128–129; срок — 10 рабочих дней", () => {
  const r = run(base, {});
  assert(!r.d.late && !r.d.needReasons);
  assert(r.text.includes("Должник: Петров Пётр Петрович") && r.text.includes("Взыскатель: ООО ПКО «Долговой центр»") && r.text.includes("Дело № 2-1234/2026"));
  assert(r.text.includes("в общей сумме 85 400,50 руб.") && r.text.includes("возражаю относительно его исполнения.") && r.text.includes("1. Отменить судебный приказ от 01.09.2026"));
  assert(!r.text.includes("ч. 2 ст. 129") && !r.text.includes("Приложения"));
  assert.equal(r.a.reason, undefined);
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d36-intime.docx", r.a, r.d);
});

t("10 рабочих дней с учётом праздника 4 ноября: получил 28.10.2026 → до 12.11.2026", () => {
  const r = run(base, { got_date: "2026-10-28" });
  assert.equal(U.fmtDate(r.d.deadline), "12.11.2026");
});

t("с доводами: список, вывод о небесспорности", () => {
  const r = run(base, { objections: ["not_mine", "limitation"] });
  assert(r.text.includes("так как:\n— я не заключал(а)") && r.text.includes("срок исковой давности.") && r.text.includes("не является бесспорным"));
});

t("копию не получал(а): обоснование по ч. 2 ст. 129 и п. 33–34 ППВС № 62, приложения, просьба принять", () => {
  const r = run(base, { got_how: "learned", got_date: U.iso(U.addDays(U.today(), -2)), reason: "elsewhere", reason_desc: "С 01.07.2026 живу в г. Казани", proofs: "Копия договора аренды\nСправка с работы" });
  assert(r.d.needReasons && !r.d.tooLate);
  assert(r.text.includes("Копию судебного приказа я не получал(а)") && r.text.includes("не проживал(а) по адресу") && r.text.includes("живу в г. Казани.") && r.text.includes("ч. 2 ст. 129") && r.text.includes("в течение десяти дней с этого дня"));
  assert(r.text.includes("1. Признать причины пропуска") && r.text.includes("2. Отменить судебный приказ") && r.text.includes("Приложения:\n1. Копия договора аренды\n2. Справка с работы"));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d36-late.docx", r.a, r.d);
});

t("копия получена давно — пропуск срока: нужны причины; узнал давно — подсказка про кассацию", () => {
  const r = run(base, { got_date: "2026-08-01" });
  assert(r.d.late && r.d.needReasons);
  assert(allErrors(r.a).includes("reason"));
  const r2 = run(base, { got_how: "learned", got_date: "2026-08-01", reason: "trip", reason_desc: "x", proofs: "y" });
  assert(r2.d.tooLate && !r2.text.includes("в течение десяти дней с этого дня"));
  assert(spec.guidance(r2.a, r2.d).some(g => g.text.includes("кассационная жалоба")));
});

t("списали деньги — подсказка о повороте исполнения (п. 35 ППВС № 62)", () => {
  const r = run(base, { withheld: "yes" });
  assert(spec.guidance(r.a, r.d).some(g => g.text.includes("п. 35")));
});

done();
