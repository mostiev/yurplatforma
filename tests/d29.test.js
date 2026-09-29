// node tests/d29.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d29");
const base = { subject: "Разработка дизайна сайта: главная и 5 внутренних страниц", deadline: "2026-10-31", price: 80000, pay: "prepay", prepay_pct: 30, pay_days: 5, accept_days: 3, rights: "alienate", former_employer: "no", city: "г. Москва", doc_date: "2026-10-01", ex_name: "Петров Пётр Петрович", ex_inn: "771234567890", ex_address: "г. Москва, ул. Ленина, д. 5", ex_phone: "+7 900 000-00-00", ex_bank: "АО «Т-Банк»", ex_account: "40817810000000000010", ex_bik: "044525974", cl_type: "org", cl_name: "ООО «Ромашка»", cl_inn: "7700000000", cl_address: "г. Москва, ул. Тверская, д. 1", cl_signer: "генерального директора Иванова Ивана Ивановича, действующего на основании Устава" };

t("договор: НПД, без НДС, предоплата 30% = 24 000, молчаливая приёмка, отчуждение прав, чек по ст. 14", () => {
  const r = run(base, {});
  assert(r.text.includes("ИНН 771234567890, применяющий(ая) специальный налоговый режим") && r.text.includes("80 000 (восемьдесят тысяч) рублей") && r.text.includes("НДС не облагается"));
  assert(r.text.includes("30% цены (24 000 руб.)") && r.text.includes("считаются оказанными и принятыми") && r.text.includes("Исключительное право на результат переходит") && r.text.includes("ст. 14 Федерального закона от 27.11.2018 № 422-ФЗ"));
  assert(r.text.includes("5. Ответственность") && r.text.includes("7. Реквизиты"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d29.docx", r.a, r.d);
});

t("без интеллектуальных прав — нумерация сдвигается; бывший работодатель — стоп", () => {
  const r = run(base, { rights: "none", pay: "after" });
  assert(r.text.includes("4. Ответственность") && r.text.includes("6. Реквизиты") && !r.text.includes("Интеллектуальные"));
  assert(run(base, { former_employer: "yes" }).stop.text.includes("пп. 8 п. 2 ст. 6"));
});

t("ИНН самозанятого — 12 цифр", () => { assert(allErrors(run(base, { ex_inn: "7700000000" }).a).includes("ex_inn")); });

done();
