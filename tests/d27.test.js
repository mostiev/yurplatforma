// node tests/d27.test.js
const assert = require("assert");
const { U, C, run, allErrors, t, done, writeDocx } = require("./_load")("d27");
// рабочий день не позже, чем n дней назад: срок в выходной сдвигается назад (ч. 8 ст. 136 ТК), тест от этого не зависит
const wdAgo = n => C.prevWorkday(U.addDays(U.today(), -n));
const ru = d => U.iso(d).split("-").reverse().join(".");
const base = {
  debts: "15.07.2026; 100000; зарплата за июнь", paid: "yes", paid_date: "2026-07-31", dismissed: "working",
  org_name: "ООО «Ромашка»", org_address: "г. Москва, ул. Мира, д. 1", position: "менеджер", refund_method: "card",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("выплачено с опозданием: компенсация 1 511,67 ₽ за 16 дней со сменой ставки 14,25% → 14%", () => {
  const r = run(base, {});
  assert.equal(r.d.comp, 1511.67); assert.equal(r.d.maxDelay, 16);
  assert(r.text.includes("× 11 дн. (16.07.2026–26.07.2026) × 1/150 × 14,25% = 1 045") && r.text.includes("Итого компенсация: 1 511,67"));
  assert(!r.text.includes("выплатить задолженность"), "долг уже выплачен");
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("несколько долгов по строкам; не выплачено — считаем по сегодня, требуем долг и компенсацию", () => {
  const d1 = wdAgo(40), d2 = wdAgo(10), n1 = U.daysBetween(d1, U.today()), n2 = U.daysBetween(d2, U.today());
  const r = run(base, { paid: "no", debts: `${ru(d1)}; 45000; зарплата\n${ru(d2)}; 30 000; аванс` });
  assert.equal(r.d.rows.length, 2); assert.equal(r.d.principal, 75000); assert.equal(r.d.maxDelay, n1);
  const manual = 45000 * 14 / 100 / 150 * n1 + 30000 * 14 / 100 / 150 * n2;
  assert.equal(r.d.comp, Math.round(manual * 100) / 100);
  assert(r.text.includes("Выплатить задолженность в размере 75 000") && r.text.includes("по день фактического расчёта"));
  writeDocx("d27.docx", r.a, r.d);
});

t("срок в субботу 15.08.2026 — платить накануне, 14.08: задержка с 15.08", () => {
  const r = run(base, { debts: "15.08.2026; 45000; зарплата", paid_date: "2026-09-10" });
  assert.equal(r.d.maxDelay, 27); assert.equal(r.d.comp, 1134);
  assert(r.text.includes("накануне, 14.08.2026, ч. 8 ст. 136"));
});

t("неверная строка — понятная ошибка", () => {
  const errs = allErrors(run(base, { debts: "вчера; много" }).a);
  assert(errs.includes("debts"));
});

t("приостановка работы — только при задержке больше 15 дней, ч. 2 ст. 142", () => {
  const due = U.iso(U.addDays(U.today(), -20)).split("-").reverse().join(".");
  const r = run(base, { paid: "no", debts: `${due}; 50000; зарплата`, suspend: "yes", suspend_from: U.iso(U.addDays(U.today(), 1)) });
  assert(r.text.includes("ч. 2 ст. 142"));
  const due2 = U.iso(U.addDays(U.today(), -5)).split("-").reverse().join(".");
  assert.equal(run(base, { paid: "no", debts: `${due2}; 50000; зарплата`, suspend: "yes" }).a.suspend, undefined);
});

done();
