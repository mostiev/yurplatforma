// node tests/d100.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d100");
const base = {
  court: "Хамовнический районный суд г. Москвы", case_no: "2-1234/2026", plaintiff: "ООО ПКО «Долговой центр»", claim_desc: "взыскать задолженность по кредитному договору № 123 от 10.01.2019",
  claim_sum: 250000, filed_date: "2026-10-15", procedure: "general", args: ["limitation", "penalty"],
  last_due: "2022-01-10", schedule: "yes", last_payment: "2021-03-10", order: "no", penalty_sum: 80000, absent: "yes",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва", buyer_phone: "+7 900",
};

t("давность по всем платежам: граница 15.10.2023, последний платёж 10.01.2022 → отказать полностью; ст. 207, п. 15 Пленума № 43; заявление о давности", () => {
  const r = run(base, {});
  assert.equal(r.d.boundary.getTime(), new Date(2023, 9, 15).getTime()); assert(r.d.allBarred);
  assert(r.text.includes("ранее 15.10.2023 срок исковой давности истёк") && r.text.includes("ст. 207 ГК РФ") && r.text.includes("Настоящим заявляю о применении исковой давности"));
  assert(r.text.includes("1. В удовлетворении исковых требований отказать полностью в связи с пропуском срока исковой давности.") && r.text.includes("ч. 5 ст. 167"));
  assert(r.text.includes("п. 71 постановления Пленума ВС РФ от 24.03.2016 № 7"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d100.docx", r.a, r.d);
});

t("часть платежей в сроке + судебный приказ сдвигает границу на время у судьи", () => {
  const r = run(base, { last_due: "2025-06-10", order: "yes", order_filed: "2025-09-01", order_cancel: "2025-10-01" });
  assert(r.d.partBarred && !r.d.allBarred && r.d.paused === 30);
  assert.equal(r.d.boundary.getTime(), new Date(2023, 8, 15).getTime());
  assert(r.text.includes("отказать в требованиях по платежам со сроком исполнения до 15.09.2023") && r.text.includes("п. 1 ст. 204 ГК РФ"));
});

t("иск в течение 6 месяцев после отмены приказа — граница от даты заявления о приказе (п. 3 ст. 204)", () => {
  const r = run(base, { last_due: "2025-06-10", order: "yes", order_filed: "2025-09-01", order_cancel: "2025-10-01", filed_date: "2026-01-15" });
  assert(r.d.ext); assert.equal(r.d.boundary.getTime(), new Date(2022, 8, 1).getTime());
  assert(r.text.includes("п. 3 ст. 204 ГК РФ") && r.text.includes("до 01.09.2022"));
});

t("коллектор и чужой договор: подлинники, экспертиза, переход к общему порядку в упрощёнке", () => {
  const r = run(base, { args: ["assign", "not_mine"], procedure: "simplified", deadline: "2026-12-10", details: "Договор не подписывал." });
  assert(r.text.includes("ст. 382, 384 ГК РФ") && r.text.includes("почерковедческую") && r.text.includes("ч. 4 ст. 232.2 ГПК РФ") && r.text.includes("ч. 2 ст. 71"));
});

t("МФО: заём до 28.01.2019 — предел не считаем, просим проверить", () => {
  const r = run(base, { args: ["mfo"], principal: 20000, loan_date: "2018-05-01" });
  assert(r.d.mfoCap === 0 && r.text.includes("подлежат проверке") && !r.text.includes("не более 0"));
});

t("МФО: предел 100% для займа 2026 года", () => {
  const r = run(base, { args: ["mfo"], principal: 20000, loan_date: "2026-05-01", paid_total: 10000 });
  assert.equal(r.d.mfoCap, 40000); assert.equal(r.d.mfoMax, 30000);
  assert(r.text.includes("не более 30 000 руб.") && r.text.includes("Отказать во взыскании сумм сверх 30 000 руб."));
});

done();
