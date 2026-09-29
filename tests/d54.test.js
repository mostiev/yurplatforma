// node tests/d54.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d54");
const base = { operator: "ООО «Ромашка»", operator_email: "privacy@romashka.ru", relation: "client", asks: ["revoke", "ads", "info"], channels: "звонки с +7 495 000-00-00",
  identifiers: "+7 900 000-00-00", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("отзыв: ч. 2 ст. 9, ч. 5 ст. 21 (30 дней), реклама — ч. 2 ст. 15 и ст. 18 закона о рекламе, сведения — ст. 14", () => {
  const r = run(base, {});
  assert(r.text.includes("ОТЗЫВ СОГЛАСИЯ") && r.text.includes("E-mail: privacy@romashka.ru"));
  assert(r.text.includes("1. На основании ч. 2 ст. 9") && r.text.includes("тридцати дней") && r.text.includes("2. На основании ч. 2 ст. 15") && r.text.includes("38-ФЗ") && r.text.includes("3. На основании ст. 14"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d54.docx", r.a, r.d);
});

t("требование прекратить — 10 рабочих дней по ч. 5.1 ст. 21; незнакомая компания", () => {
  const r = run(base, { asks: ["stop"], relation: "unknown" });
  assert(r.text.startsWith("Кому") && r.text.includes("ТРЕБОВАНИЕ") && r.text.includes("ч. 5.1 ст. 21") && r.text.includes("десяти рабочих дней") && r.text.includes("согласия на обработку персональных данных вам не давал"));
});

t("подсказки: ФАС для рекламы, работодатель хранит кадровые документы", () => {
  const g = spec.guidance({ ...base, relation: "employee" }, run(base, { relation: "employee" }).d).map(x => x.title).join(" ");
  assert(g.includes("ФАС") && g.includes("работодатель"));
});

done();
