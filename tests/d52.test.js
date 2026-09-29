// node tests/d52.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d52");
const base = { org_type: "bank", org: "ПАО «Банк»", org_inn: "7700000000", contract: "Кредитный договор № 1 от 01.09.2026", violations: ["extras", "refund"],
  desc: "10.09.2026 я отказался от страховки, 60 000 ₽ не вернули.", prior: "answered", prior_date: "2026-09-12", want: "вернуть 60 000 ₽", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("жалоба в ЦБ: адрес Неглинная, нарушения со ссылками на 353-ФЗ, претензия приложена", () => {
  const r = run(base, {});
  assert(r.text.includes("ул. Неглинная, д. 12, к. В") && r.text.includes("(ИНН 7700000000)") && r.text.includes("ст. 7 Федерального закона от 21.12.2013 № 353-ФЗ"));
  assert(r.text.includes("12.09.2026 я обратился(ась) в организацию") && r.text.includes("Цель обращения: вернуть 60 000 ₽.") && r.text.includes("Копия претензии в организацию и её ответа."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d52.docx", r.a, r.d);
});

t("коллекторы и мошенники — стоп с переадресацией; без претензии — совет начать с организации", () => {
  assert(run(base, { org_type: "collector" }).stop.text.includes("Д-42")); assert(run(base, { org_type: "fraud" }).stop);
  const r = run(base, { prior: "no" });
  assert.equal(r.a.prior_date, undefined); assert(spec.guidance(r.a, r.d)[0].title.includes("Сначала"));
});

done();
