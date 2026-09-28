// node tests/d47.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d47");
const base = { full: "yes", bank: "ПАО «Банк»", loan: "№ 1 от 01.03.2025", repaid_date: "2026-03-01", linked: "rate", form: "individual", insurer: "ООО СК «Страховая»",
  policy_no: "№ 12345", premium: 100000, start_date: "2025-03-01", end_date: "2030-02-28", events: "no", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("индивидуальный полис: ч. 12 ст. 11, пропорция по дням, все риски по письму ЦБ", () => {
  const r = run(base, {});
  assert.equal(r.d.total, 1826); assert.equal(r.d.used, 366);
  assert.equal(r.d.refund, Math.round(100000 * 1460 / 1826 * 100) / 100);
  assert(r.text.includes("ч. 12 ст. 11") && r.text.includes("ч. 2.4 ст. 7") && r.text.includes("ИН-06-59/50") && r.text.includes("× (1826 − 366) / 1826"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d47.docx", r.a, r.d);
});

t("коллективное — в банк по ч. 10", () => {
  const r = run(base, { form: "collective" });
  assert(r.text.startsWith("Кому: ПАО «Банк»") && r.text.includes("ч. 10 ст. 11"));
});

t("частичное погашение, не связана с кредитом, страховой случай — стоп", () => {
  assert(run(base, { full: "part" }).stop); assert(run(base, { linked: "no" }).stop.text.includes("ст. 958")); assert(run(base, { events: "yes" }).stop);
});

done();
