// node tests/d45.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d45");
const base = { loan_kind: "consumer", bank: "ПАО «Банк»", contract: "№ 625/0000-0012345 от 15.03.2025", loan_amount: 300000, used_before: "no", court: "no",
  basis: "income", inc12: 90000, inc2: 50000, submit_date: "2026-10-01", months: 4, notify: "email", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("доход упал на 44,4%: п. 1 ч. 2 ст. 6.1-2, 4 месяца с даты подачи, ответ за 5 рабочих дней, ч. 15 и 18", () => {
  const r = run(base, {});
  assert.equal(r.d.drop, 44.4);
  assert(r.text.includes("снизился на 44,4%") && r.text.includes("продолжительностью 4 месяца — с 01.10.2026 по 31.01.2027"));
  assert(r.text.includes("ч. 11 ст. 6.1-2) по электронной почте p@example.com") && r.text.includes("ч. 15") && r.text.includes("ч. 18"));
  assert(r.text.includes("2-НДФЛ"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d45.docx", r.a, r.d);
});

t("лимиты: 450 000 / карта 150 000 / авто 1 600 000; ипотека — стоп", () => {
  assert(run(base, { loan_amount: 450001 }).stop); assert(!run(base, { loan_amount: 450000 }).stop);
  assert(run(base, { loan_kind: "card", loan_amount: 200000 }).stop);
  assert(!run(base, { loan_kind: "auto", loan_amount: 1500000 }).stop);
  assert(run(base, { loan_kind: "mortgage" }).stop);
});

t("снижение ровно 30% — мало; повтор по тому же основанию, суд — стоп", () => {
  assert(run(base, { inc2: 63000 }).stop.title.includes("30%"));
  assert(run(base, { used_before: "income" }).stop); assert(!run(base, { used_before: "chs" }).stop);
  assert(run(base, { court: "yes" }).stop);
});

t("ЧС: 60 дней; по умолчанию 6 месяцев", () => {
  const r = run(base, { basis: "chs", chs_date: "2026-09-01", chs_desc: "паводок в г. Орске", months: undefined });
  assert(!r.stop && r.text.includes("зоне чрезвычайной ситуации (паводок в г. Орске)") && r.text.includes("6 месяцев — с 01.10.2026 по 31.03.2027"));
  assert(run(base, { basis: "chs", chs_date: "2026-07-01", chs_desc: "x" }).stop);
});

done();
