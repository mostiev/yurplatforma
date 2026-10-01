// node tests/d71.test.js — претензия, судебный приказ, иск в арбитраж
const assert = require("assert");
const { U, C, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d71");
const base = Object.assign({}, spec.defaults, {
  contract_no: "12/2026", contract_date: "2026-03-01",
  debts: [{ doc: "УПД № 15 от 01.08.2026", due: "2026-08-11", amount: 200000 }, { doc: "УПД № 20 от 01.09.2026", due: "2026-09-11", amount: 100000, paid: 40000 }, {}],
  calc_date: "2026-10-01", doc_date: "2026-10-01", court_name: "Арбитражный суд города Москвы",
  cr_name: "ООО «Поставка»", cr_inn: "7701234567", cr_address: "г. Москва, ул. Складская, д. 10", cr_head_pos: "Генеральный директор", cr_head: "Сидоров Сидор Сидорович", cr_account: "40702810000000000001", cr_bank: "ПАО Сбербанк", cr_bik: "044525225",
  db_name: "ООО «Кофейня»", db_inn: "7707654321", db_address: "г. Москва, ул. Ленина, д. 5",
});

t("госпошлина в арбитраж: шкала и приказ (50%, не меньше 8 000)", () => {
  assert.equal(C.arbFee(50000), 10000); assert.equal(C.arbFee(500000), 30000); assert.equal(C.arbFee(2000000), 85000); assert.equal(C.arbFee(1e9), 5475000); assert.equal(C.arbFee(3e9), 1e7);
  assert.equal(C.arbOrderFee(100000), 8000); assert.equal(C.arbOrderFee(500000), 15000);
});

t("претензия: долг, пени 0,1% по каждой строке, реквизиты, срок 30 дней", () => {
  const r = run(base, {});
  assert.equal(r.d.debt, 260000);
  // 200 000 × 0,1% × 51 день (12.08–01.10) = 10 200; 60 000 × 0,1% × 20 дней (12.09–01.10) = 1 200
  assert.equal(r.d.pen, 11400); assert.equal(r.d.price, 271400);
  assert(r.text.includes("ПРЕТЕНЗИЯ") && r.text.includes("Итого: долг 260 000 руб., неустойка (пени) — 11 400 руб., всего 271 400 руб."));
  assert(r.text.includes("в течение 30 календарных дней") && r.text.includes("р/с 40702810000000000001 в ПАО Сбербанк, БИК 044525225"));
  assert(r.text.includes("судебного приказа или иском"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d71-claim.docx", r.a, r.d);
});

t("ограничение пени по договору", () => {
  assert.equal(run(base, { cap_pct: 2 }).d.pen, Math.min(10200, 4000) + Math.min(1200, 2000));
});

t("судебный приказ: признание долга, пошлина, недоступен свыше 750 000", () => {
  const r = run(base, { stage: "order", proof: "act" });
  assert(r.text.includes("ЗАЯВЛЕНИЕ") && r.text.includes("о выдаче судебного приказа") && r.text.includes("актом сверки взаимных расчётов") && r.text.includes("ст. 229.1–229.5 АПК"));
  assert.equal(r.d.fee, C.arbOrderFee(271400)); assert(r.text.includes(`Государственная пошлина: ${U.money(r.d.fee).replace(/\s/g, " ")} руб.`));
  writeDocx("d71-order.docx", r.a, r.d);
  const big = run(base, { stage: "order", debts: [{ doc: "Акт № 1", due: "2026-08-11", amount: 900000 }] });
  assert.equal(big.a.stage, undefined, "приказ сброшен — сумма больше 750 000");
});

t("иск: претензионный порядок, проценты до фактической оплаты, ранняя подача — предупреждение", () => {
  const r = run(base, { stage: "suit", claim_date: "2026-08-25", claim_answer: "none", penalty: "law395" });
  assert(r.text.includes("ИСКОВОЕ ЗАЯВЛЕНИЕ") && r.text.includes("Претензионный порядок соблюдён") && r.text.includes("истёк 24.09.2026"));
  assert(r.text.includes("по день фактической оплаты долга по ключевой ставке") && r.d.pen > 0);
  assert.equal(r.d.fee, C.arbFee(r.d.price));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d71-suit.docx", r.a, r.d);
  const early = run(base, { stage: "suit", claim_date: "2026-09-20", claim_answer: "none" });
  assert(spec.guidance(early.a, early.d)[0].title.includes("не раньше 20.10.2026"));
});

done();
