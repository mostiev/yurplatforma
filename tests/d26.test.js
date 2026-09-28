// node tests/d26.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d26");
const base = {
  violations: ["salary", "no_contract"], illegal_dismissal: "no", desc: "не выплатили зарплату за июль и август", confidential: "yes",
  org_name: "ООО «Ромашка»", org_address: "г. Москва, ул. Мира, д. 1", position: "менеджер", work_status: "working", git: "Государственная инспекция труда в г. Москве",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("жалоба: нарушения списком, ст. 356/357, 5.27 КоАП, конфиденциальность по ст. 358", () => {
  const r = run(base, {});
  assert(r.text.includes("— задерживают или не платят зарплату;") && r.text.includes("— не оформили трудовой договор;"));
  assert(r.text.includes("ст. 353, 356, 357") && r.text.includes("ст. 5.27") && r.text.includes("ст. 358"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d26.docx", r.a, r.d);
});

t("без просьбы о конфиденциальности — пункта нет", () => {
  assert(!run(base, { confidential: "no" }).text.includes("ст. 358"));
});

t("нужно выбрать хотя бы одно нарушение", () => {
  assert(allErrors(run(base, { violations: undefined }).a).includes("violations"));
});

t("незаконное увольнение — стоп: суд в течение месяца", () => {
  assert(run(base, { illegal_dismissal: "yes" }).stop);
});

done();
