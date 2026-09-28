// node tests/d11.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d11");
const base = {
  service_desc: "Лечение кариеса зуба 36", contract_date: U.iso(U.addDays(U.today(), -30)), paid: 60000, want_docs: "no",
  org_name: "ООО «Дента-Люкс»", org_address: "г. Москва, ул. Зубная, д. 3",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("отказ от лечения: вернуть оплаченное минус оказанное, ст. 32 и 7 дней", () => {
  const r = run(base, { situation: "refuse", rendered: 15000, refund_method: "card" });
  assert.equal(r.d.refundRefuse, 45000);
  assert(r.text.includes("45 000") && r.text.includes("ст. 32") && r.text.includes("7 дней") && r.text.includes("ст. 84"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("оказано больше, чем оплачено — ошибка", () => {
  assert(allErrors(run(base, { situation: "refuse", rendered: 70000, refund_method: "card" }).a).includes("paid"));
});

t("качество: исправление по ст. 29–30, неустойка 3%; копии документов по 323-ФЗ", () => {
  const r = run(base, { situation: "quality", defect: "выпала пломба", fix_failed: "no", essential: "no", demand: "fix", fix_days: 7, want_docs: "yes" });
  assert(r.text.includes("ст. 29") && r.text.includes("ст. 30") && r.text.includes("3%") && r.text.includes("ч. 5 ст. 22"));
  writeDocx("d11-quality.docx", r.a, r.d);
});

t("вред здоровью — стоп, к юристу", () => {
  assert(run(base, { situation: "harm" }).stop);
});

t("пациент — другой человек", () => {
  assert(run(base, { situation: "refuse", rendered: 0, refund_method: "cash", patient: "Петрова Анна Петровна" }).text.includes("пациент — Петрова Анна Петровна"));
});

done();
