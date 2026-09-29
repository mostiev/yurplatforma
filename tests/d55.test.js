// node tests/d55.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d55");
const base = { kind: "dispute", bki: "АО «Национальное бюро кредитных историй»", wrong: ["not_mine"], source: "ООО МФК «Займ»", record: "договор № 123 от 10.02.2026 на 30 000 ₽",
  proofs: "Талон-уведомление из полиции", police: "yes", submit_date: "2026-10-01",
  buyer_birth: "1990-01-01", passport: "45 12 345678, выдан МВД 01.02.2020", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("оспаривание: ч. 3, 4 ст. 8 218-ФЗ, полиция, 20 рабочих дней", () => {
  const r = run(base, {});
  assert(r.text.includes("ЗАЯВЛЕНИЕ") && r.text.includes("ООО МФК «Займ»") && r.text.includes("который я не получал(а)") && r.text.includes("обратился(ась) в полицию"));
  assert(r.text.includes("ч. 3 и 4 ст. 8") && r.text.includes("20 рабочих дней") && r.text.includes("1. Копия паспорта.\n2. Талон-уведомление") && r.text.includes("01.10.2026            ____________ / Петров П. П."));
  assert.equal(U.fmtDate(r.d.answerBy), "29.10.2026");
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d55.docx", r.a, r.d);
});

t("запрос отчёта: ч. 2 ст. 8, бесплатно до двух раз, бумага — раз в год", () => {
  const r = run(base, { kind: "report", report_form: "paper" });
  assert(r.text.includes("ЗАПРОС") && r.text.includes("ч. 2 ст. 8") && r.text.includes("на бумажном носителе") && r.text.includes("не более двух раз") && !r.text.includes("оспаривании"));
  assert.equal(r.a.wrong, undefined);
});

done();
