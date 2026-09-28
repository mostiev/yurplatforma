// node tests/d48.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d48");
const base = { to: "provider", service: "road", provider: "ООО «Авто Ассистанс»", provider_inn: "7700000000", provider_address: "г. Москва, ул. Тверская, д. 1", cert: "Сертификат № AA-1 от 01.09.2026",
  price: 150000, from_credit: "yes", used: "no", bank: "ПАО «Банк»", loan: "№ 1 от 01.09.2026", agreed_date: "2026-09-01", submit_date: "2026-09-20", refund_method: "requisites", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("в 30 дней: п. 3 ч. 2.1, ч. 2.7, 2.9 ст. 7 — полностью за 7 рабочих дней; угроза обратиться к кредитору", () => {
  const r = run(base, {});
  assert(r.text.includes("ИНН 7700000000") && r.text.includes("Копия: ПАО «Банк»") && r.text.includes("ч. 2.7 ст. 7") && r.text.includes("ч. 2.9 ст. 7") && r.text.includes("в полном объёме"));
  assert(r.text.includes("ч. 2.10 ст. 7") && r.text.includes("Оплата произведена за счёт кредитных средств"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d48-provider.docx", r.a, r.d);
});

t("после 30 дней — ст. 32 ЗоЗПП и 782 ГК, фактические расходы, штраф 50%", () => {
  const r = run(base, { submit_date: "2026-10-15" });
  assert(r.text.includes("ст. 32") && r.text.includes("ст. 782") && r.text.includes("фактически понесённых") && r.text.includes("п. 6 ст. 13") && !r.text.includes("ч. 2.9"));
});

t("к банку: только если отказ был в 30 дней и прошло 30–180 дней после отказа", () => {
  const b = { ...base, to: "bank", bank_address: "г. Москва", refused_date: "2026-09-10" };
  assert(run(b, { submit_date: "2026-10-05" }).stop, "рано");
  const r = run(b, { submit_date: "2026-10-15" });
  assert(!r.stop && r.text.includes("ТРЕБОВАНИЕ") && r.text.includes("ч. 2.10 и 2.11") && r.text.includes("в размере 150 000 руб.,"));
  assert(run(b, { submit_date: "2027-04-01" }).stop, "поздно");
  writeDocx("d48-bank.docx", r.a, r.d);
});

done();
