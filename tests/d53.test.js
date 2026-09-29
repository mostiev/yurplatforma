// node tests/d53.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d53");
const base = { rpn: "Управление Роспотребнадзора по г. Москве", seller: "ООО «Ромашка»", seller_address: "г. Москва, ул. Тверская, д. 1", buy_date: "2026-09-01",
  violations: ["quality", "claim"], desc: "Пылесос перестал включаться через 4 дня.", claim_date: "2026-09-06", court: "yes", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("жалоба: ЗоЗПП, ст. 40, 59-ФЗ, КоАП 14.7/14.8, заключение в суде", () => {
  const r = run(base, {});
  assert(r.text.includes("ст. 4, 18, 29 Закона") && r.text.includes("06.09.2026 я направил(а) продавцу") && r.text.includes("ст. 14.7, 14.8") && r.text.includes("ст. 47 ГПК РФ") && r.text.includes("ст. 12 Федерального закона № 59-ФЗ"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d53.docx", r.a, r.d);
});

t("без суда — без пункта о заключении; без претензии — без абзаца о ней", () => {
  const r = run(base, { court: "no", claim_date: undefined });
  assert(!r.text.includes("ст. 47 ГПК") && !r.text.includes("направил(а) продавцу"));
});

done();
