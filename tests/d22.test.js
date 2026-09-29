// node tests/d22.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d22");
const base = { kids: "Петров Иван Петрович; 01.02.2016\nПетрова Мария Петровна; 05.05.2019", method: "fixed", fixed: 40000, income: 100000, index: "pm", pay_day: 10, how: "card", until: "adult", penalty: 0.1,
  payer_name: "Петров Пётр Петрович", payer_birth: "1988-01-01", payer_passport: "45 12 345678", payer_address: "г. Москва, ул. Мира, д. 1",
  rec_name: "Петрова Анна Ивановна", rec_birth: "1990-01-01", rec_passport: "45 13 111222", rec_address: "г. Москва, ул. Ленина, д. 5", city: "г. Москва" };

t("твёрдая сумма на двоих не ниже 1/3 дохода; индексация по ст. 117; неустойка 0,1% по соглашению", () => {
  const r = run(base, {});
  assert(!r.stop);
  assert(r.text.includes("40 000 (сорок тысяч) рублей") && r.text.includes("ст. 105, 117") && r.text.includes("0,1% от суммы невыплаченных") && r.text.includes("п. 1 ст. 115"));
  assert(r.text.includes("При достижении совершеннолетия одним из Детей") && r.text.includes("ст. 111"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d22.docx", r.a, r.d);
});

t("меньше, чем по суду — стоп (п. 2 ст. 103): 30 000 < 33 333,33", () => {
  const r = run(base, { fixed: 30000 });
  assert(r.stop && r.stop.text.replace(/\u00a0/g, " ").includes("33 333,33"));
  assert(run(base, { method: "share", share_pct: 30 }).stop, "30% < 1/3");
  assert(!run(base, { method: "share", share_pct: 33.34 }).stop);
  assert(run(base, { method: "share", share_pct: 20, kids: "Петров Иван Петрович; 01.02.2016" }).stop, "20% < 25%");
});

t("без неустойки — прямо сказано, что не предусмотрена", () => {
  assert(run(base, { penalty: undefined }).text.includes("неустойка соглашением не предусмотрена"));
});

done();
