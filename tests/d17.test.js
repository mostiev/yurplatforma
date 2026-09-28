// node tests/d17.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d17");
const base = {
  flood_date: "2026-09-10", act: "yes", act_date: "2026-09-10", cause: "разрыв гибкой подводки в кв. 49", damage_desc: "потолок и обои на кухне",
  estimate_type: "appraiser", estimate_doc: "отчёт № 123/26", damage: 185000, appraisal: 8000, other_costs: 2000, refund_method: "card",
  to_name: "Сидоров Сидор Сидорович", to_address: "г. Москва, ул. Ленина, д. 5, кв. 49", my_address: "г. Москва, ул. Ленина, д. 5, кв. 45",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 45", buyer_phone: "+7 900 000-00-00",
};

t("сосед: ст. 1064, 15 ГК, ч. 4 ст. 30 ЖК; сумма = ущерб + оценка + расходы; без ЗоЗПП", () => {
  const r = run(base, { culprit: "neighbor" });
  assert.equal(r.d.total, 195000);
  assert(r.text.includes("ст. 1064") && r.text.includes("ч. 4 ст. 30") && r.text.includes("195 000"));
  assert(!r.text.includes("защите прав потребителей"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d17-neighbor.docx", r.a, r.d);
});

t("УК: ч. 2.3 ст. 161, ПП 491, ст. 14 ЗоЗПП, штраф 50%", () => {
  const r = run(base, { culprit: "uk", to_name: "ООО «УК Жилкомфорт»", cause: "разрыв общего стояка" });
  assert(r.text.includes("ч. 2.3 ст. 161") && r.text.includes("№ 491") && r.text.includes("ст. 14") && r.text.includes("50%"));
});

t("виновник неизвестен — стоп с инструкцией", () => {
  assert(run(base, { culprit: "unknown" }).stop);
});

done();
