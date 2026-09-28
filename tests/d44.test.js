// node tests/d44.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d44");
const base = { reason: "aml", what: ["card", "dbo"], since: "2026-09-20", card_last4: "1234", account: "40817810000000000010",
  ops: "10.09.2026 получил 180 000 ₽ за проданный автомобиль", docs: "Договор купли-продажи автомобиля от 09.09.2026\nВыписка по счёту", close: "no",
  bank: "АО «Банк»", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com" };

t("115-ФЗ: причины за 5 рабочих дней, пояснение, документы в приложении, только 4 цифры карты", () => {
  const r = run(base, {});
  assert(r.text.includes("последние цифры номера 1234") && r.text.includes("не позднее пяти рабочих дней") && r.text.includes("Поясняю: 10.09.2026 получил 180 000"));
  assert(r.text.includes("Рассмотреть прилагаемые документы") && r.text.includes("Приложения:\n1. Договор купли-продажи"));
  assert(!r.text.includes("ст. 859"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d44.docx", r.a, r.d);
});

t("полный номер карты не принимаем", () => {
  assert(allErrors(run(base, { card_last4: "2202200011112222" }).a).includes("card_last4"));
});

t("161-ФЗ: база ЦБ, передать заявление в ЦБ на следующий рабочий день; закрыть счёт по ст. 859", () => {
  const r = run(base, { reason: "fraud", fraud_desc: "перевод 15 000 ₽ — возврат долга", close: "yes", payout: "cash" });
  assert(r.text.includes("161-ФЗ") && r.text.includes("не позднее следующего рабочего дня") && r.text.includes("п. 1 ст. 859") && r.text.includes("п. 3 ст. 859"));
  assert.equal(r.a.docs, undefined);
});

t("приставы и налоговая — стоп с переадресацией", () => {
  assert(run(base, { reason: "bailiffs" }).stop.text.includes("Д-40")); assert(run(base, { reason: "tax" }).stop);
});

done();
