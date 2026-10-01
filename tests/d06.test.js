// node tests/d06.test.js — претензия по покупке на маркетплейсе
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d06");
const base = Object.assign({}, spec.defaults, {
  order_no: "123456789", order_date: "2026-09-10", product: "Пылесос Dreame V12", price: 25990, seller: "ИП Иванов Иван Иванович", seller_inn: "771234567890",
  received_date: "2026-09-15", defect_desc: "Перестал включаться", return_how: "pvz",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Тула, ул. Садовая, д. 2", buyer_phone: "+7 900 222-22-22", submit_date: "2026-10-01",
});

t("брак: продавцу через платформу (п. 3.1 ст. 18), 10 дней, возврат через платформу, короткий текст", () => {
  const r = run(base, {});
  assert(r.text.includes("Продавцу: ИП Иванов Иван Иванович (ИНН 771234567890)") && r.text.includes("через платформу «Wildberries» (п. 3.1 ст. 18"));
  assert(r.text.includes("вернуть уплаченную за товар сумму — 25 990 руб.") && r.text.includes("10 дней") && r.text.includes("с использованием платформы"));
  assert(r.text.includes("не более уплаченной суммы") && r.text.includes("Короткий текст для чата"));
  assert.equal(U.fmtDate(r.d.answerBy), "11.10.2026");
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d06-defect.docx", r.a, r.d);
});

t("не тот товар: ремонт и уценка недоступны", () => {
  const r = run(base, { problem: "wrong", demand: "repair" });
  assert.equal(r.a.demand, undefined, "ремонт сброшен");
  assert(allErrors(r.a).includes("demand"));
  assert(run(base, { problem: "wrong", demand: "replace" }).text.includes("ст. 4 Закона, ст. 466, 468, 478 ГК"));
});

t("недоставка, оплата на платформе: претензия продавцу + требование оператору (п. 2.2 ст. 12)", () => {
  const r = run(base, { problem: "not_delivered", due_date: "2026-09-20", nd_demand: "refund", operator: "ООО «РВБ»" });
  assert(r.text.includes("п. 2 ст. 23.1") && r.text.includes("0,5%") && r.text.includes("с 21.09.2026"));
  assert(r.text.includes("ТРЕБОВАНИЕ") && r.text.includes("Кому: ООО «РВБ», оператору платформы «Wildberries»") && r.text.includes("п. 2.2 ст. 12") && r.text.includes("10 календарных дней"));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d06-not-delivered.docx", r.a, r.d);
  assert(!run(base, { problem: "not_delivered", due_date: "2026-09-20", nd_demand: "deliver", new_due: "2026-10-10" }).text.includes("ТРЕБОВАНИЕ"));
});

t("возврат исправного: 7 дней или 3 месяца, КС № 7-П при отправке почтой", () => {
  const r = run(base, { problem: "return_good", received_date: "2026-09-28", return_how: "post" });
  assert.equal(U.fmtDate(r.d.returnLast), "05.10.2026"); assert(!r.d.returnLate);
  assert(r.text.includes("п. 4 ст. 26.1") && r.text.includes("№ 7-П"));
  const late = run(base, { problem: "return_good", received_date: "2026-09-01" });
  assert(late.d.returnLate && spec.guidance(late.a, late.d).some(g => g.title.includes("прошёл")));
  const three = run(base, { problem: "return_good", received_date: "2026-09-01", info_given: "no" });
  assert(!three.d.returnLate && three.text.includes("три месяца"));
});

done();
