// node tests/d08.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d08");
const iso = d => U.iso(d), today = U.today();
const base = {
  service: "Онлайн-кинотеатр «Кино+»", account: "p@example.com", card_last4: "1234", refund_method: "card",
  org_name: "ООО «Кино Плюс»", org_address: "г. Москва, ул. Тверская, д. 10",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("отмена годовой подписки: пропорциональный возврат", () => {
  const last = U.addDays(today, -65);
  const r = run(base, { situation: "cancel", last_charge_date: iso(last), last_charge: 3650, period: "year" });
  const days = U.daysBetween(last, U.addMonths(last, 12));
  assert.equal(r.d.periodDays, days); assert.equal(r.d.left, days - 65);
  assert.equal(r.d.refund, Math.round(3650 * (days - 65) / days * 100) / 100);
  assert(r.text.includes("ст. 32") && r.text.includes("п. 4.2 ст. 16.1"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("списания после отказа: вся сумма, п. 4.2 ст. 16.1, 7 дней", () => {
  const r = run(base, { situation: "after_cancel", cancel_date: iso(U.addDays(today, -40)), cancel_how: "отключил в кабинете", charged_total: 598 });
  assert.equal(r.d.refund, 598); assert(r.text.includes("отсутствуют основания") && r.text.includes("7 дней"));
  assert.deepEqual(allErrors(r.a), []);
  writeDocx("d08-after.docx", r.a, r.d);
});

t("без согласия: ст. 16 и три дня", () => {
  const r = run(base, { situation: "no_consent", first_charge_date: iso(U.addDays(today, -20)), charged_total: 1990 });
  assert(r.text.includes("без согласия") && r.text.includes("трёх дней") && r.text.includes("ст. 16"));
});

t("карта — только 4 цифры", () => {
  assert(allErrors(run(base, { situation: "cancel", card_last4: "1234567812345678" }).a).includes("card_last4"));
});

t("смена ситуации стирает чужие поля", () => {
  const r = run(base, { situation: "cancel", charged_total: 500, cancel_how: "x" });
  assert.equal(r.a.charged_total, undefined); assert.equal(r.a.cancel_how, undefined);
});

done();
