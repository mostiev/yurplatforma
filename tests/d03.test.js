// node tests/d03.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d03");

const base = {
  course_name: "«Профессия: Python-разработчик»", school_name: "ООО «Онлайн-школа»", school_address: "г. Москва, ул. Садовая, д. 2",
  paid_date: U.iso(U.addDays(U.today(), -20)), price: 120000, payment: "full",
  progress: "partial", lessons_total: 40, lessons_done: 4, contract_term: "no", refund_rules: "no", refund_method: "card",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com",
};

t("пропорциональный расчёт: 4 из 40 уроков от 120 000 — вернуть 108 000", () => {
  const r = run(base, {});
  assert.equal(r.d.rendered, 12000); assert.equal(r.d.refund, 108000);
  assert(r.text.includes("108 000"));
});

t("не начинал — возврат всей суммы", () => {
  const r = run(base, { progress: "none" });
  assert.equal(r.d.refund, 120000); assert(r.text.includes("120 000 руб. на банковскую"));
});

t("рассрочка школе: возврат считается от уже оплаченного", () => {
  const r = run(base, { payment: "installments", paid_amount: 30000 });
  assert(r.text.includes("вернуть мне денежные средства в размере 18 000"));
});

t("рассрочка, оплачено меньше пройденного — к возврату 0, не минус", () => {
  const r = run(base, { payment: "installments", paid_amount: 5000 });
  assert(r.text.includes("в размере 0 руб."));
});

t("кредит: вариант «на кредитный счёт» доступен только при кредите", () => {
  const r = run(base, { payment: "credit", bank_name: "АО «Банк»", refund_method: "loan" });
  assert.equal(r.a.refund_method, "loan"); assert(r.text.includes("АО «Банк»"));
  const r2 = run(base, { refund_method: "loan" });
  assert.equal(r2.a.refund_method, undefined, "без кредита вариант должен сброситься");
});

t("срок: 7 дней по ст. 314 ГК, если договор молчит; срок из договора, если есть", () => {
  assert(run(base, {}).text.includes("7 дней") && run(base, {}).text.includes("п. 2 ст. 314"));
  const r = run(base, { contract_term: "yes", contract_days: 10 });
  assert(r.text.includes("в течение 10 дней") && !r.text.includes("ст. 314"));
});

t("нет законной неустойки — только проценты по ст. 395", () => {
  const txt = run(base, {}).text;
  assert(!txt.includes("неустойк")); assert(txt.includes("ст. 395"));
});

t("кабальные условия оферты — ссылка на пп. 3 п. 2 ст. 16", () => {
  assert(run(base, { refund_rules: "yes" }).text.includes("пп. 3 п. 2 ст. 16"));
  assert(!run(base, { refund_rules: "no" }).text.includes("ст. 16"));
});

t("пройдено больше, чем уроков, — ошибка валидации", () => {
  assert(allErrors(run(base, { lessons_done: 50 }).a).includes("lessons_done"));
});

t("полный документ без пропусков, .docx собирается", () => {
  const r = run(base, {});
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d03-partial.docx", r.a, r.d);
});

done();
