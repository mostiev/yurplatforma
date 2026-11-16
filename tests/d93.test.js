// node tests/d93.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d93");
const base = {
  creditor: "mfo", creditor_name: "ООО МКК «Быстроденьги»", contract_no: "№ 123", loan_date: "2026-05-10", principal: 20000, short: "yes",
  paid_total: 15000, claimed: 30000, reason: "job", reason_desc: "С 01.09.2026 сокращён(а).", ask: ["schedule", "penalty"], can_pay: 3000,
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("МФО после 01.04.2026: предел 100% — начислено 25 000 сверх займа, превышение 5 000, требовать можно 25 000", () => {
  const r = run(base, {});
  assert.equal(r.d.cap.txt, "100%"); assert.equal(r.d.accrued, 25000); assert.equal(r.d.over, 5000); assert.equal(r.d.maxLeft, 25000);
  assert(r.text.includes("не может превышать 100% суммы займа") && r.text.includes("545-ФЗ") && r.text.includes("на 5 000 руб. больше законного предела"));
  assert(r.text.includes("1. Произвести перерасчёт задолженности и списать начисления сверх законного предела — 5 000 руб."));
  assert(r.text.includes("с ежемесячным платежом не более 3 000 руб.") && r.text.includes("ч. 1 ст. 10"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d93.docx", r.a, r.d);
});

t("заём 2024 года — 130%, без превышения", () => {
  const r = run(base, { loan_date: "2024-05-10" });
  assert.equal(r.d.cap.txt, "130%"); assert.equal(r.d.over, 0); assert(r.text.includes("требовать с меня можно не более 31 000 руб."));
});

t("ставка выше 0,8% в день — отдельный довод", () => {
  const r = run(base, { daily_rate: 1 });
  assert(r.d.rateOver && r.text.includes("ч. 23 ст. 5"));
});

t("банк: без расчёта предела, просьба об увеличении срока; следующий шаг — каникулы", () => {
  const r = run({ ...base, creditor: "bank", creditor_name: "ПАО «Банк»", principal: 500000, ask: ["term"], monthly: 25000 }, {});
  assert(!r.d.cap && r.text.includes("договор кредита") && r.text.includes("Увеличить срок кредита"));
});

done();
