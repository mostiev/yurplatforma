// node tests/d92.test.js
const assert = require("assert");
const { U, C, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d92");
const fired = U.addDays(U.today(), -14);
const base = {
  org_name: "ООО «Ромашка»", org_inn: "7701234567", org_address: "г. Москва, ул. Тверская, д. 1", position: "менеджер по продажам", hired_date: "2024-02-01",
  fired_date: U.iso(fired), order_no: "№ 45-к", basis: "absence", flaws: ["no_explain", "good_reason"], details: "Был(а) у врача, справка есть.",
  want: "restore", pay_basis: "daily", avg_daily: 3500, moral_amount: 30000, court: "Хамовнический районный суд г. Москвы",
  buyer_name: "Петров Пётр Петрович", buyer_birth: "1990-05-01", buyer_birthplace: "г. Москва", buyer_id: "СНИЛС 123-456-789 00", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("прогул без объяснительной: восстановить, прогул по рабочим дням × средний дневной, моральный вред, немедленное исполнение", () => {
  const r = run(base, {});
  let n = 0; for (let x = U.addDays(fired, 1); x <= U.today(); x = U.addDays(x, 1)) if (C.isWorkday(x)) n++;
  assert.equal(r.d.days, n); assert.equal(r.d.lost, n * 3500);
  assert(r.text.includes("Прокурор (для дачи заключения") && r.text.includes("истец освобождён (ст. 393 ТК РФ"));
  assert(r.text.includes("ч. 1 ст. 193 ТК РФ") && r.text.includes("п. 23 постановления Пленума ВС РФ от 17.03.2004 № 2"));
  assert(r.text.includes(`Восстановить меня на работе у ООО «Ромашка» в должности менеджер по продажам с ${U.fmtDate(U.addDays(fired, 1))}`));
  assert(r.text.includes("к немедленному исполнению") && r.text.includes("компенсацию морального вреда 30 000 руб."));
  assert(!r.text.includes("Восстановить срок"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d92.docx", r.a, r.d);
});

t("месяц на иск — от вручения копии приказа: 30.10.2026 → 30.11.2026", () => {
  assert.equal(U.fmtDate(run(base, { fired_date: "2026-10-30", got_date: "2026-10-30" }).d.deadline), "30.11.2026");
});

t("изменить формулировку вместо восстановления; без немедленного исполнения", () => {
  const r = run(base, { want: "change" });
  assert(r.text.includes("Изменить формулировку основания увольнения на увольнение по собственному желанию") && !r.text.includes("немедленному"));
  assert(r.text.includes("об изменении формулировки"));
});

t("сокращение: свои нарушения в списке; выходное пособие зачитывается", () => {
  const r = run(base, { basis: "reduction", flaws: ["no_notice", "no_vacancy"], severance: 20000 });
  assert(r.text.includes("ч. 2 ст. 180 ТК РФ") && r.text.includes("ч. 3 ст. 81 ТК РФ") && r.text.includes("п. 62 постановления Пленума"));
  const opts = spec.steps[1].questions.filter(q => q.id === "flaws" && q.show({ basis: "reduction" }));
  assert(opts.length === 1 && !opts[0].options.some(o => o.value === "no_explain"));
});

t("только зарплата — оценка среднего: × 12 / 247, с пометкой «ориентировочно»", () => {
  const r = run(base, { pay_basis: "salary", avg_daily: undefined, salary: 98800 });
  assert(r.d.estimated && Math.abs(r.d.daily - 98800 * 12 / 247) < 0.01 && r.text.includes("ориентировочно"));
});

t("срок прошёл — шаг «Срок», просьба восстановить по ч. 5 ст. 392", () => {
  const r = run(base, { fired_date: "2026-08-03", got_date: "2026-08-03", late_reason: "ждал(а) ответа инспекции труда" });
  assert(r.d.late && r.text.includes("1. Восстановить срок обращения в суд.") && r.text.includes("ч. 5 ст. 392"));
});

t("по собственному под давлением — п. 22 Пленума № 2", () => {
  assert(run(base, { basis: "own", flaws: ["forced"] }).text.includes("п. 22 Пленума ВС РФ № 2"));
});

done();
