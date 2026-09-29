// node tests/d19.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d19");
const base = { developer: "ООО «СЗ Новый дом»", developer_address: "г. Москва, ул. Тверская, д. 1", ddu: "№ ДДУ-123/45 от 10.03.2023", contract_new: "no", object: "кв. № 45", price: 10000000,
  stage: "after", handed_date: "2025-03-01", defects: "Отклонение стены 12 мм на 2 м\nПродувание окна на кухне", expert: "ООО «Эксперт», заключение № 45 от 01.09.2026", cost: 350000, demand: "costs", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00" };

t("после передачи: гарантия, ч. 2 и 6 ст. 7, возмещение расходов 350 000, неустойка ч. 8, штраф 5%", () => {
  const r = run(base, {});
  assert(r.text.includes("1) Отклонение стены 12 мм на 2 м\n2) Продувание") && r.text.includes("350 000 руб.") && r.text.includes("ч. 8 ст. 7") && r.text.includes("5%"));
  assert.equal(U.fmtDate(r.d.warrantyEnd), "28.02.2030");
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d19.docx", r.a, r.d);
});

t("на осмотре до приёмки — акт осмотра; устранить за 30 дней", () => {
  const r = run(base, { stage: "before", inspect_date: "2026-09-20", demand: "fix", fix_days: 30 });
  assert(r.text.includes("При осмотре объекта 20.09.2026") && r.text.includes("в срок 30 календарных дней") && r.text.includes("Составить акт осмотра") && !r.text.includes("реквизитам"));
});

t("гарантия истекла (3 года для новых договоров) — стоп", () => {
  assert(run(base, { contract_new: "yes", handed_date: "2022-01-10" }).stop);
  assert(!run(base, { contract_new: "no", handed_date: "2022-01-10" }).stop, "5 лет ещё идут");
});

done();
