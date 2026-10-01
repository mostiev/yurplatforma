// node tests/d74.test.js — гарантийное письмо
const assert = require("assert");
const { spec, run, allErrors, t, done, writeDocx } = require("./_load")("d74");
const base = Object.assign({}, spec.defaults, {
  basis: "договору поставки № 12/2026 от 01.03.2026", amount: 300000, pay_by: "2026-11-15", ask: "nocourt", doc_date: "2026-10-01",
  fr_name: "ООО «Кофейня»", fr_inn: "7707654321", fr_address: "г. Москва", fr_head_pos: "Генеральный директор", fr_head: "Петров Пётр Петрович",
  to_name: "ООО «Поставка»", to_inn: "7701234567", to_address: "г. Москва",
});
t("признание долга одним платежом + просьба не судиться", () => {
  const r = run(base, {});
  assert(r.text.includes("признаёт задолженность") && r.text.includes("300 000 (триста тысяч) рублей") && r.text.includes("не позднее 15.11.2026") && r.text.includes("не обращаться в суд"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d74.docx", r.a, r.d);
});
t("график: сумма должна сходиться, платежи в календарь", () => {
  const ok = run(base, { schedule: "plan", plan: [{ date: "2026-10-15", sum: 100000 }, { date: "2026-11-15", sum: 200000 }] });
  assert.deepEqual(allErrors(ok.a), []); assert(ok.text.includes("до 15.10.2026 — 100 000 руб.; до 15.11.2026 — 200 000 руб."));
  assert.equal(spec.reminders(ok.a, ok.d).length, 2);
  assert(allErrors(Object.assign({}, ok.a, { plan: [{ date: "2026-10-15", sum: 100000 }] })).includes("plan"));
});
done();
