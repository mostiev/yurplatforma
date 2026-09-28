// node tests/d05.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d05");
const ago = n => U.iso(U.addDays(U.today(), -n));
const base = {
  flight_kind: "domestic", flight_no: "SU 1234", flight_date: ago(10), route: "Москва — Сочи", ticket_no: "555 1234567890",
  passengers: "Петров Пётр Петрович", fare: 12400, bought_via: "airline", refund_method: "same",
  airline_name: "ПАО «Аэрофлот»", airline_address: "г. Москва, ул. Арбат, д. 1",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("отмена рейса: полный возврат, п. 2 ст. 108", () => {
  const r = run(base, { reason: "cancel" });
  assert(r.text.includes("п. 2 ст. 108") && r.text.includes("12 400")); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("задержка больше 30 минут и отказ лететь: ссылка на приказ № 341 и невозвратный тариф", () => {
  const r = run(base, { reason: "delay_refused" });
  assert(r.text.includes("30 минут") && r.text.includes("№ 341") && r.text.includes("невозвратному"));
});

t("задержка и полёт: 100 ₽ за полный час, не больше 50% провозной платы", () => {
  assert.equal(run(base, { reason: "delay_flew", delay_hours: 7.9 }).d.fine, 700);
  assert.equal(run(base, { reason: "delay_flew", delay_hours: 200 }).d.fine, 6200);
  const r = run(base, { reason: "delay_flew", delay_hours: 7 });
  assert(r.text.includes("ст. 120") && r.text.includes("Выплатить штраф за просрочку доставки пассажира в размере 700"));
});

t("расходы добавляются как убытки", () => {
  const r = run(base, { reason: "cancel", expenses: 4500, expenses_desc: "гостиница" });
  assert(r.text.includes("Возместить убытки в размере 4 500") && r.text.includes("ст. 15, 393 ГК"));
});

t("болезнь: нужно уведомление до конца регистрации, иначе стоп", () => {
  assert(!run(base, { reason: "illness", notified: "yes", proof_doc: "справка" }).stop);
  assert(run(base, { reason: "illness", notified: "no" }).stop);
  assert(run(base, { reason: "illness", notified: "yes", proof_doc: "справка № 5" }).text.includes("справка № 5"));
});

t("добровольный отказ — стоп с объяснением", () => { assert(run(base, { reason: "voluntary" }).stop); });

t("6 месяцев на претензию — только для внутренних рейсов", () => {
  assert(run(base, { reason: "cancel", flight_date: U.iso(U.addMonths(U.today(), -7)) }).stop);
  assert(!run(base, { reason: "cancel", flight_kind: "international", flight_date: U.iso(U.addMonths(U.today(), -7)) }).stop);
});

t("агент упоминается, претензия всё равно перевозчику; ответ в 30 дней", () => {
  const r = run(base, { reason: "cancel", bought_via: "agent", agent_name: "Туту" });
  assert(r.text.includes("через агента Туту") && r.text.includes("ПАО «Аэрофлот»") && r.text.includes("ст. 127.1"));
  writeDocx("d05-cancel.docx", r.a, r.d);
});

done();
