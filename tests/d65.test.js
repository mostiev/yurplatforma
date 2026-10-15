// node tests/d65.test.js
const assert = require("assert");
const { run, spec, U, C, allErrors, t, done, writeDocx } = require("./_load")("d65");
const base = Object.assign({}, spec.defaults, {
  doc_ref: "расписка от 15.03.2025", loan_date: "2025-03-15", amount: 300000, due_date: "2025-09-15",
  debtor_name: "Сидоров Олег Павлович", debtor_address: "г. Москва, ул. Мира, д. 3", debtor_id: "паспорт 45 12 345678",
  buyer_name: "Иванов Иван Иванович", buyer_birth: "1990-01-01", buyer_birthplace: "г. Москва", buyer_id: "паспорт 45 13 123456", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
  court: "Мировому судье судебного участка № 12 района Хамовники г. Москвы", doc_date: "2026-09-30",
});

t("расписка 300 000 без процентов в тексте: проценты по ключевой ставке + 395, приказ", () => {
  const r = run(base, {});
  const i809 = C.comp395(300000, U.date("2025-03-16"), U.date("2026-09-30"), []).total;
  const i395 = C.comp395(300000, U.date("2025-09-16"), U.date("2026-09-30"), []).total;
  assert.equal(r.d.i809.total, i809); assert.equal(r.d.i395.total, i395);
  assert.equal(r.d.total, Math.round((300000 + i809 + i395) * 100) / 100);
  assert(r.d.order && r.d.total < 500000);
  assert.equal(r.d.fee, Math.round(C.courtFee(r.d.total) / 2));
  assert(r.text.includes("ЗАЯВЛЕНИЕ") && r.text.includes("о вынесении судебного приказа") && r.text.includes("абзац третий ст. 122"));
  assert(r.text.includes("п. 1 ст. 809 ГК РФ") && r.text.includes("п. 1 ст. 811"));
  assert(r.text.includes("Дата и (или) место рождения должника мне неизвестны (п. 3 ч. 2 ст. 124 ГПК РФ)"));
  assert(r.text.includes("ч. 4 ст. 124") && r.text.includes("Расчёт процентов"));
  assert(!r.text.includes("по день фактической уплаты"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d65.docx", r.a, r.d);
});

t("до 100 000 без условия — беспроцентный; только 395", () => {
  const r = run(base, { amount: 80000 });
  assert.equal(r.d.i809.total, 0); assert(r.d.i395.total > 0);
  assert(r.text.includes("п. 4 ст. 809"));
});

t("больше 500 000 — иск в районный суд, проценты по день уплаты", () => {
  const r = run(base, { amount: 900000, interest: "rate", rate: 12, court: "Хамовнический районный суд г. Москвы" });
  assert(!r.d.order && r.d.court === "районный суд");
  // 12% годовых простые: 900 000 × 12% × 564 дня / 365 (16.03.2025–30.09.2026)
  assert(Math.abs(r.d.i809.total - (900000 * 0.12 * 564 / 365)) < 0.05);
  assert(r.text.includes("ИСКОВОЕ ЗАЯВЛЕНИЕ") && r.text.includes("по день фактической уплаты долга") && r.text.includes("п. 6 ст. 132"));
  assert.equal(r.d.fee, C.courtFee(r.d.total));
});

t("приказ отменён — иск с зачётом пошлины; частичный возврат", () => {
  const r = run(base, { cancelled: "yes", cancel_info: "определение от 01.09.2026", order_fee: 5000, paid: 100000, paid_date: "2025-12-01" });
  assert(!r.d.order && r.d.principal === 200000 && r.d.offset === 5000);
  assert(r.text.includes("ст. 129 ГПК") && r.text.includes("с зачётом 5"));
});

t("до востребования без требования — стоп; срок не наступил — стоп; без документов — стоп", () => {
  assert(run(base, { due_type: "demand" }).stop.link.href === "d35.html");
  const dm = run(base, { due_type: "demand", demand_date: "2026-08-01" });
  assert(!dm.stop && U.fmtDate(dm.d.due) === "31.08.2026");
  assert(run(base, { due_date: "2026-12-01" }).stop.title.includes("не наступил"));
  assert(run(base, { basis: "none" }).stop.link.href === "d35.html");
});

done();
