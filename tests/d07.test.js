// node tests/d07.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d07");
const iso = d => U.iso(d), today = U.today();
const base = {
  place: "fitness", org_name: "ООО «Фитнес-Плюс»", org_address: "г. Москва, ул. Спортивная, д. 1", buy_date: iso(U.addDays(today, -100)), price: 36500,
  kind: "time", activated: "yes", start_date: iso(U.addDays(today, -100)), end_date: iso(U.addDays(today, 265)),
  bad_rules: "no", contract_term: "no", refund_method: "card",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("годовой абонемент: 365 дней, осталось 265 — вернуть 36500 × 265/365 = 26 500", () => {
  const r = run(base, {}); assert.equal(r.d.total, 365); assert.equal(r.d.left, 265); assert.equal(r.d.refund, 26500);
  assert(r.text.includes("26 500"));
});

t("пакет посещений: 10 процедур, использовано 3 — вернуть 70%", () => {
  const r = run(base, { kind: "visits", price: 20000, visits_total: 10, visits_used: 3 });
  assert.equal(r.d.refund, 14000); assert(r.text.includes("14 000"));
});

t("не активирован — полный возврат", () => {
  const r = run(base, { activated: "no" }); assert.equal(r.d.refund, 36500);
  assert.equal(r.a.start_date, undefined, "лишние даты стираются");
});

t("абонемент закончился — стоп", () => {
  assert(run(base, { start_date: iso(U.addDays(today, -400)), end_date: iso(U.addDays(today, -35)) }).stop);
});

t("кабальные правила клуба — пп. 3 п. 2 ст. 16", () => {
  assert(run(base, { bad_rules: "yes" }).text.includes("пп. 3 п. 2 ст. 16"));
});

t("срок: 7 дней по ст. 314 или из договора; без неустойки", () => {
  const txt = run(base, {}).text; assert(txt.includes("7 дней") && !txt.includes("неустойк"));
  assert(run(base, { contract_term: "yes", contract_days: 30 }).text.includes("в течение 30 дней"));
});

t("использовано больше, чем есть — ошибка; полный документ собирается", () => {
  assert(allErrors(run(base, { kind: "visits", visits_total: 5, visits_used: 7 }).a).includes("visits_used"));
  const r = run(base, {}); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d07-time.docx", r.a, r.d);
});

done();
