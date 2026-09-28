// node tests/d40.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d40");
const base = {
  osp: "Хамовнический ОСП ГУФССП России по г. Москве", bailiff: "Иванова А. А.", ip_no: "123456/26/77001-ИП", creditor: "ПАО «Банк»", what: "debt",
  pays: ["alimony", "kids"], happened: "both", bank: "ПАО Сбербанк", account: "40817810000000000010", writeoffs: "12.09.2026; 14500\n15.09.2026; 3000", only: "yes",
  buyer_name: "Петрова Анна Ивановна", buyer_address: "г. Москва, ул. Мира, д. 3", buyer_phone: "+7 900 000-00-00",
};

t("списали и арестовали: пункты ч. 1 ст. 101 по порядку, сумма списаний, снять арест со счёта, вернуть 17 500", () => {
  const r = run(base, {});
  assert.deepEqual(r.d.pts, [7, 12]);
  assert(r.text.includes("(п. 7, 12)") && r.text.includes("ч. 4.1 ст. 70") && r.text.includes("Списаны: 12.09.2026 — 14 500 руб; 15.09.2026 — 3 000 руб. Всего 17 500 руб."));
  assert(r.text.includes("1. Снять арест с денежных средств на счёте № 40817810000000000010, поскольку на этот счёт поступают только") && r.text.includes("2. Возвратить на мой счёт № 40817810000000000010 незаконно списанные денежные средства в размере 17 500 руб." ) && !r.text.includes("руб.."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d40.docx", r.a, r.d);
});

t("только арест, смешанный счёт — отменить в части защищённых доходов, без возврата", () => {
  const r = run(base, { happened: "arrest", only: "no" });
  assert(r.text.includes("в части доходов, на которые") && !r.text.includes("Возвратить"));
  assert.equal(r.a.writeoffs, undefined);
});

t("алименты с должника и возмещение вреда здоровью — стоп по ч. 2 ст. 101", () => {
  assert(run(base, { what: "alimony", pays: ["harm"] }).stop);
  assert(!run(base, { what: "alimony", pays: ["kids"] }).stop);
});

done();
