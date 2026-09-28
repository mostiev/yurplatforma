// node tests/d09.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d09");
const inDays = n => U.iso(U.addDays(U.today(), n));
const base = {
  contract_date: inDays(-30), destination: "Турция, Анталья, отель «Солнце» 5*", trip_start: inDays(20), trip_end: inDays(30), price: 180000, refund_method: "card",
  operator_name: "ООО «Турцентр»", operator_address: "г. Москва, ул. Мира, д. 1", agent_name: "ООО «Горящие туры»",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("отказ до поездки: ст. 32, удержание только подтверждённых расходов, копия агенту", () => {
  const r = run(base, { situation: "refuse" });
  assert(r.text.includes("ст. 32") && r.text.includes("подтверждённых документально") && r.text.includes("Копия: ООО «Горящие туры» (турагент)"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("независящие обстоятельства: ст. 10 Закона о туризме, причина в тексте", () => {
  const r = run(base, { situation: "circumstances", circumstance: "visa", circumstance_desc: "отказ консульства от 01.09.2026" });
  assert(r.text.includes("отказ в выдаче визы") && r.text.includes("ст. 10"));
});

t("изменение условий туроператором и угроза безопасности — полный возврат", () => {
  const c = run(base, { situation: "operator_changed", change_desc: "перенёс даты" });
  assert(c.d.full && c.text.includes("180 000") && c.text.includes("в полном объёме"));
  const s = run(base, { situation: "safety", safety_desc: "рекомендация Ростуризма" });
  assert(s.d.full && s.text.includes("ст. 14"));
  writeDocx("d09-safety.docx", s.a, s.d);
});

t("плохой тур: уменьшение цены по ст. 29 и неустойка 3%", () => {
  const r = run(base, { situation: "bad_trip", trip_start: inDays(-20), trip_end: inDays(-10), bad_desc: "не тот отель", amount: 30000, expenses: 5000 });
  assert(r.text.includes("30 000") && r.text.includes("5 000") && r.text.includes("3%"));
  assert(!r.stop);
});

t("отказ после начала тура — стоп", () => {
  assert(run(base, { situation: "refuse", trip_start: inDays(-2) }).stop);
});

t("закон о защите прав потребителей назван полностью, даже если первой идёт ссылка на закон о туризме", () => {
  const txt = run(base, { situation: "safety", safety_desc: "угроза" }).text;
  assert(txt.includes("Закона РФ «О защите прав потребителей»"));
});

done();
