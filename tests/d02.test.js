// node tests/d02.test.js
const assert = require("assert");
const { spec, U, run, allErrors, t, done, writeDocx } = require("./_load")("d02");
const ago = n => U.iso(U.addDays(U.today(), -n));

const person = {
  seller_name: "ООО «Ромашка»", seller_address: "г. Москва, ул. Тверская, д. 1",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};
const store = Object.assign({ channel: "store", product: "Куртка, размер 50", received_date: ago(5), price: 12990, proof: "receipt", non_exchange: "none", reason: "size", unused: "yes" }, person);
const online = Object.assign({ channel: "online", product: "Кроссовки, 42", received_date: ago(3), price: 8990, proof: "ereceipt", return_info: "yes", custom: "no", unused: "yes", refund_method: "card" }, person);

t("магазин: 14-й день после покупки ещё можно, 15-й уже нет", () => {
  assert(!run(store, { received_date: ago(14) }).stop);
  assert(run(store, { received_date: ago(15) }).stop);
});

t("интернет-магазин: 7 дней, без письменной информации о возврате — 3 месяца", () => {
  assert(!run(online, { received_date: ago(7) }).stop);
  assert(run(online, { received_date: ago(8) }).stop);
  assert(!run(online, { received_date: ago(60), return_info: "no" }).stop);
  assert(run(online, { received_date: U.iso(U.addDays(U.addMonths(U.today(), -3), -1)), return_info: "no" }).stop);
});

t("«не помню» про информацию о возврате — считаем осторожно, 7 дней", () => {
  assert(run(online, { received_date: ago(10), return_info: "unknown" }).stop);
});

t("товар из перечня, продукты — стоп в магазине; перечень не мешает онлайн", () => {
  assert(run(store, { non_exchange: "cosmetics" }).stop);
  assert(run(store, { non_exchange: "food" }).stop);
  const q = spec.steps[1].questions.find(x => x.id === "non_exchange");
  assert(!q.show(online));
});

t("индивидуальный товар онлайн и потерянный товарный вид — стоп", () => {
  assert(run(online, { custom: "yes" }).stop);
  assert(run(store, { unused: "no" }).stop);
});

t("маркетплейс и частное лицо — стоп", () => {
  assert(run(store, { channel: "marketplace" }).stop.link.href === "d06.html");
  assert(run(store, { channel: "private" }).stop);
});

t("магазин, обмен: ст. 25 п. 1 и запасной вариант с возвратом через 3 дня", () => {
  const r = run(store, { demand: "exchange", exchange_for: "та же модель, размер 52" });
  assert(r.text.includes("п. 1 ст. 25") && r.text.includes("трёх дней"));
  assert.deepEqual(allErrors(r.a), []);
});

t("магазин, возврат денег: способ возврата обязателен", () => {
  const r = run(store, { demand: "refund" });
  assert(allErrors(r.a).includes("refund_method"));
  const r2 = run(store, { demand: "refund", refund_method: "cash" });
  assert.deepEqual(allErrors(r2.a), []); assert(r2.text.includes("п. 2 ст. 25"));
});

t("онлайн: п. 4 ст. 26.1, 10 дней, проценты по ст. 395 вместо неустойки", () => {
  const r = run(online, {});
  assert(r.text.includes("п. 4 ст. 26.1") && r.text.includes("10 дней") && r.text.includes("ст. 395"));
  assert(!r.text.includes("неустойк"));
  assert(!r.text.includes("⟨"));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d02-online.docx", r.a, r.d);
});

t("онлайн без письменной информации — фраза про три месяца", () => {
  assert(run(online, { return_info: "no", received_date: ago(30) }).text.includes("три месяца"));
});

done();
