// node tests/d66.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d66");
const base = Object.assign({}, spec.defaults, {
  bank: "ПАО Сбербанк", card4: "1234", sms_date: "2026-09-12", told_date: "2026-09-13",
  story: "12.09.2026 около 11:00 мне позвонили с номера +7 900 000-00-45 и представились службой безопасности банка",
  op1_date: "2026-09-12", op1_time: "11:20", op1_sum: 50000, op1_to: "перевод по СБП на +7 9XX XXX-XX-12", op1_more: "yes",
  op2_date: "2026-09-12", op2_sum: 30000,
  buyer_name: "Иванова Мария Петровна", buyer_birth: "1980-01-01", buyer_address: "г. Москва, ул. Мира, д. 1", buyer_phone: "+7 900 000-00-00", app_date: "2026-09-13",
});

t("списали без согласия: ч. 11, 15 ст. 9, вовремя, + полиция", () => {
  const r = run(base, {});
  assert.equal(r.d.total, 80000); assert.equal(r.d.inTime, true);
  assert(r.text.includes("о несогласии с операциями и возмещении") && r.text.includes("**** 1234"));
  assert(r.text.includes("1) 12.09.2026 в 11:20 — 50 000 (пятьдесят тысяч) рублей, получатель: перевод по СБП"));
  assert(r.text.includes("в срок, установленный ч. 11 ст. 9") && r.text.includes("ч. 15 ст. 9"));
  assert(r.text.includes("о преступлении") && r.text.includes("ст. 306 УК РФ") && r.text.includes("талон-уведомление"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d66.docx", r.a, r.d);
});

t("опоздал с уведомлением — подсказка про ч. 13", () => {
  const r = run(base, { told_date: "2026-09-20" });
  assert.equal(r.d.inTime, false);
  assert(!r.text.includes("в срок, установленный"));
  assert(spec.guidance(r.a, r.d).some(g => g.title.includes("пропущен") && g.text.includes("ч. 13")));
});

t("перевёл под обманом: ст. 8 ч. 3.13, признаки ОД-2506, ст. 1102", () => {
  const r = run(base, { kind: "deceived" });
  assert(r.text.includes("Под влиянием обмана") && r.text.includes("№ ОД-2506") && r.text.includes("ч. 3.13 ст. 8"));
  assert(spec.guidance(r.a, r.d).some(g => g.text.includes("ст. 1102")));
});

t("кредит: самозапрет, ВС, кредитная история; без полиции", () => {
  const r = run(base, { kind: "credit", credit_date: "2026-09-10", credit_sum: 300000, self_ban: "yes", police: "no" });
  assert.equal(r.d.total, 300000);
  assert(r.text.includes("о несогласии с заключением кредитного договора") && r.text.includes("ч. 6 ст. 13") && r.text.includes("5-КГ22-121-К2"));
  assert(r.text.includes("кредитную историю") && !r.text.includes("о преступлении") && !r.text.includes("****"));
  assert.deepEqual(allErrors(r.a), []);
});

t("номер карты — только 4 цифры", () => {
  assert(allErrors(Object.assign({}, base, { card4: "1234567812345678" })).includes("card4"));
});

done();
