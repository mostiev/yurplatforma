// node tests/d46.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d46");
const base = { credit: "yes", form: "individual", insurer: "ООО СК «Страховая»", bank: "ПАО «Банк»", loan: "№ 1 от 01.09.2026", policy_no: "№ 12345",
  signed_date: "2026-09-01", premium: 60000, events: "no", submit_date: "2026-09-25", refund_method: "requisites", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("при кредите, полис: 30 дней, ч. 11 ст. 11 — полностью за 7 рабочих дней; копия банку", () => {
  const r = run(base, {});
  assert(r.text.includes("Копия: ПАО «Банк»") && r.text.includes("ч. 11 ст. 11") && r.text.includes("в полном объёме в течение семи рабочих дней"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d46-credit.docx", r.a, r.d);
});

t("коллективная программа — заявление в банк об исключении, ч. 2.5 ст. 7", () => {
  const r = run(base, { form: "collective", bank_address: "г. Москва" });
  assert(r.text.startsWith("Кому: ПАО «Банк»") && r.text.includes("исключить меня из числа застрахованных") && r.text.includes("ч. 2.5 ст. 7"));
});

t("30 дней прошли — стоп (последний день 01.10.2026)", () => {
  assert(!run(base, { submit_date: "2026-10-01" }).stop);
  assert(run(base, { submit_date: "2026-10-02" }).stop.text.includes("01.10.2026"));
});

t("без кредита: 14 дней по 3854-У; страхование началось — пропорционально", () => {
  const r = run(base, { credit: "no", signed_date: "2026-09-20", start_date: "2026-09-21", end_date: "2027-09-20", submit_date: "2026-09-30", premium: 36500 });
  assert.equal(r.d.totalDays, 365); assert.equal(r.d.usedDays, 10); assert.equal(r.d.refund, 35500);
  assert(r.text.includes("3854-У") && r.text.includes("(10 из 365 дн.), — 35 500 руб.") && r.text.includes("10 рабочих дней"));
  const r2 = run(base, { credit: "no", signed_date: "2026-09-20", start_date: "2026-10-05", end_date: "2027-10-04", submit_date: "2026-09-30" });
  assert(r2.text.includes("в полном объёме (п. 5 Указания)"));
  assert(run(base, { credit: "no", signed_date: "2026-09-01", start_date: "2026-09-02", end_date: "2027-09-01", submit_date: "2026-09-16" }).stop);
  writeDocx("d46-plain.docx", r.a, r.d);
});

t("страховой случай — стоп", () => { assert(run(base, { events: "yes" }).stop); });

done();
