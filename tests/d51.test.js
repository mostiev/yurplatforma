// node tests/d51.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d51");
const base = {
  insurer: "ПАО СК «Страховая»", case_no: "ПР1234567", accident: "10.08.2026, г. Москва, ул. Профсоюзная, д. 1", car: "Kia Rio, А123ВС777", filed_date: "2026-08-12",
  problem: "cash_instead", paid: 120000, paid_date: "2026-09-10", expert_sum: 210000, expert: "ООО «Эксперт», заключение № 45 от 01.09.2026", expert_cost: 8000,
  claim_penalty: "yes", submit_date: "2026-10-01", refund_method: "same",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("20 дней без праздников: подано 12.08.2026 → 01.09.2026 (праздников нет)", () => {
  assert.equal(U.fmtDate(run(base, {}).d.due), "01.09.2026");
});

t("праздники не считаются, выходные считаются: 25.12.2026 + 20 → 22.01.2027", () => {
  // 26–31 декабря = 6, 1–8 января пропускаем, 9–22 января = 14 → 20
  assert.equal(U.fmtDate(run(base, { filed_date: "2026-12-25" }).d.due), "22.01.2027");
});

t("деньги вместо ремонта: п. 15.1, 16.1 ст. 12, п. 56 ППВС № 31; разница 90 000, экспертиза, неустойка 1%", () => {
  const r = run(base, {});
  assert.equal(r.d.diff, 90000);
  const days = U.daysBetween(U.date("2026-09-01"), U.today());
  assert.equal(r.d.penalty, Math.round(90000 * 0.01 * days * 100) / 100);
  assert(r.text.includes("п. 15.1 ст. 12") && r.text.includes("п. 16.1 ст. 12") && r.text.includes("п. 56") && r.text.includes("выплаченной суммой — 90 000 руб.") && r.text.includes("Недоплата — 90 000 руб."));
  assert(r.text.includes("расходы на независимую экспертизу — 8 000 руб.") && r.text.includes("п. 3 ст. 16.1") && r.text.includes("указанным в заявлении о страховом возмещении"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d51.docx", r.a, r.d);
});

t("выплатили с опозданием: неустойка по дату выплаты", () => {
  const r = run(base, { problem: "late", paid: 150000, paid_date: "2026-09-11" });
  assert.equal(r.d.penaltyDays, 10); assert.equal(r.d.penalty, 15000);
  assert(r.text.includes("150 000 руб. × 1% × 10 дн. = 15 000 руб.") && !r.text.includes("экспертиз"));
});

t("ничего не выплатили, без экспертизы — просьба о направлении на ремонт", () => {
  const r = run(base, { problem: "nothing", expert_sum: undefined, claim_penalty: "no" });
  assert(r.text.includes("выдать направление на восстановительный ремонт") && !r.text.includes("неустойк"));
});

done();
