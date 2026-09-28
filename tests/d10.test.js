// node tests/d10.test.js
const assert = require("assert");
const { spec, U, run, allErrors, t, done, writeDocx } = require("./_load")("d10");
const inDays = n => U.iso(U.addDays(U.today(), n));
const base = {
  car: "Kia Rio, А123ВС777", order_no: "ЗН-1234", order_date: inDays(-20), works: "Замена сцепления", price: 40000,
  org_name: "ООО «Автомастер»", org_address: "г. Москва, ул. Моторная, д. 7",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};
const refundOpt = spec.steps[0].questions.find(q => q.id === "demand").options.find(o => o.value === "refund");

t("плохой ремонт: исправление в срок, ПП № 780 упомянуто", () => {
  const r = run(base, { situation: "quality", defect: "рывки", fix_failed: "no", essential: "no", demand: "fix", fix_days: 10 });
  assert(r.text.includes("№ 780") && r.text.includes("в течение 10 дней") && r.text.includes("3%"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  assert(refundOpt.disabled(r.a, r.d));
});

t("просрочка: неустойка 3% в день, не больше цены работ", () => {
  const r = run(base, { situation: "delay", deadline_date: inDays(-5), delay_demand: "new_term", new_days: 3 });
  assert.equal(r.d.lateDays, 5); assert.equal(r.d.penalty, 6000); assert(r.text.includes("6 000"));
  assert.equal(run(base, { situation: "delay", deadline_date: inDays(-50), delay_demand: "refuse", refund_method: "card" }).d.penalty, 40000);
});

t("срок ещё не прошёл — стоп", () => {
  assert(run(base, { situation: "delay", deadline_date: inDays(3) }).stop);
});

t("повреждение машины: ст. 35, двукратная стоимость", () => {
  const r = run(base, { situation: "damage", damage_desc: "царапина", damage_in_act: "yes", damage_cost: 12000, refund_method: "card" });
  assert(r.text.includes("п. 1 ст. 35") && r.text.includes("24 000"));
  writeDocx("d10-damage.docx", r.a, r.d);
});

t("работы без согласия: пп. 6 п. 2 ст. 16; оплачено — вернуть за три дня, не оплачено — исключить", () => {
  const paid = run(base, { situation: "extra", extra_desc: "колодки", extra_sum: 5500, extra_paid: "yes", refund_method: "card" });
  assert(paid.text.includes("пп. 6 п. 2 ст. 16") && paid.text.includes("трёх дней"));
  const unpaid = run(base, { situation: "extra", extra_desc: "колодки", extra_sum: 5500, extra_paid: "no" });
  assert(unpaid.text.includes("исключить стоимость")); assert.equal(unpaid.a.refund_method, undefined);
});

done();
