// node tests/d16.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d16");
const base = {
  problem: "roof", desc: "протекает кровля над кв. 45", asked_uk: "written", uk_request: "заявление от 01.09.2026 вх. № 512", uk_answer: "none", photos: "yes",
  house_address: "г. Тула, ул. Ленина, д. 5", flat: "45", uk_name: "ООО «УК Жилкомфорт»", inspection: "Государственная жилищная инспекция Тульской области", inspection_address: "г. Тула, ул. Советская, д. 1",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Тула, ул. Ленина, д. 5, кв. 45", buyer_phone: "+7 900 000-00-00",
};

t("жалоба: ч. 2.3 ст. 161 ЖК, ПП 491, ст. 20 ЖК, 59-ФЗ; обращение в УК и отсутствие ответа", () => {
  const r = run(base, {});
  assert(r.text.includes("ч. 2.3 ст. 161") && r.text.includes("№ 491") && r.text.includes("ст. 20") && r.text.includes("59-ФЗ"));
  assert(r.text.includes("вх. № 512") && r.text.includes("Ответ не получен"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d16.docx", r.a, r.d);
});

t("без обращения в УК — подсказка сначала обратиться, вопрос об ответе скрыт", () => {
  const r = run(base, { asked_uk: "no" });
  assert.equal(r.a.uk_answer, undefined); assert.equal(r.a.uk_request, undefined);
});

done();
