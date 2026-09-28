// node tests/d34.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d34");
const base = {
  role: "lender", city: "г. Москва", doc_date: "2026-10-01", amount: 300000, how: "cash", return: "date", due_date: "2027-10-01", back_how: "account",
  interest: "rate", rate: 12, rate_pay: "monthly", rate_day: 10, penalty: "law",
  lender_name: "Петров Пётр Петрович", lender_birth: "1980-05-01", lender_passport: "45 12 345678, выдан ГУ МВД России по г. Москве 01.02.2020", lender_address: "г. Москва, ул. Ленина, д. 5", lender_phone: "+7 900 000-00-00",
  borrower_name: "Сидоров Сидор Сидорович", borrower_birth: "1990-03-03", borrower_passport: "45 13 111222, выдан МВД 05.05.2015", borrower_address: "г. Москва, ул. Мира, д. 1", borrower_phone: "+7 900 111-11-11",
};

t("процентный заём: ставка, ежемесячно, досрочно с уведомлением за 30 дней, ст. 395, реальный договор", () => {
  const r = run(base, {});
  assert(r.text.includes("300 000 (триста тысяч) рублей (далее — сумма займа)") && r.text.includes("12% годовых") && r.text.includes("не позднее 10-го числа"));
  assert(r.text.includes("не менее чем за тридцать дней") && r.text.includes("п. 6 ст. 809") && r.text.includes("п. 1 ст. 807") && r.text.includes("п. 1 ст. 811"));
  assert(r.text.includes("5. Ответственность сторон") && r.text.includes("7. Подписи сторон") && r.text.includes("наличными получил(а) полностью"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d34-rate.docx", r.a, r.d);
});

t("беспроцентный, частями: график 3 платежа, остаток копеек в последнем; досрочное взыскание остатка по п. 2 ст. 811", () => {
  const r = run(base, { interest: "none", return: "parts", parts: 3, first_date: "2026-11-15", amount: 100000 });
  assert.deepEqual(r.d.plan.map(x => x.sum), [33333.33, 33333.33, 33333.34]);
  assert(r.text.includes("1) не позднее 15.11.2026 — 33 333,33 руб.") && r.text.includes("3) не позднее 15.01.2027 — 33 333,34 руб."));
  assert(r.text.includes("Заём является беспроцентным") && r.text.includes("п. 2 ст. 811") && !r.text.includes("4. Проценты"));
  assert(r.text.includes("4. Ответственность сторон") && r.text.includes("6. Подписи сторон"));
  assert.equal(r.a.rate, undefined); assert.equal(r.a.due_date, undefined);
  writeDocx("d34-parts.docx", r.a, r.d);
});

t("перевод на счёт: срок перевода, без строки «получил наличными»; по требованию — 30 дней", () => {
  const r = run(base, { how: "transfer", transfer_days: 3, return: "demand" });
  assert(r.text.includes("в течение 3 дней со дня подписания") && !r.text.includes("наличными получил") && r.text.includes("тридцати дней со дня предъявления"));
});

t("своя неустойка; ставка 40% — подсказка про ростовщические проценты", () => {
  const r = run(base, { penalty: "custom", penalty_rate: 0.1, rate: 40 });
  assert(r.text.includes("0,1% от просроченной суммы") && !r.text.includes("ст. 395"));
  assert(spec.guidance(r.a, r.d).some(g => g.text.includes("п. 5 ст. 809")));
});

t("проверки: дата возврата после договора, платежей 2–60", () => {
  assert(allErrors(run(base, { due_date: "2026-09-01" }).a).includes("due_date"));
  assert(allErrors(run(base, { return: "parts", parts: 1, first_date: "2026-11-01" }).a).includes("parts"));
});

done();
