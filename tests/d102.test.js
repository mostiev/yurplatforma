// node tests/d102.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d102");
const got = U.iso(U.addDays(U.today(), -5));
const base = {
  stage: "decision", kind: "property", year: 2025, decl_date: "2026-03-01", ifns: "Инспекция ФНС России № 4 по г. Москве", doc_no: "№ 1234 от 20.10.2026",
  got_date: got, amount: 260000, reason: "не представлены документы об оплате", args: "Выписка банка была приложена.", ufns: "УФНС России по г. Москве",
  buyer_name: "Петров Пётр Петрович", buyer_inn: "770123456789", buyer_address: "г. Москва", buyer_phone: "+7 900",
};

t("апелляционная жалоба в УФНС через инспекцию: ст. 139.1, отменить решение, подтвердить вычет", () => {
  const r = run(base, {});
  assert(r.text.startsWith("Кому: УФНС России по г. Москве\nПодаётся через: Инспекция ФНС России № 4"));
  assert(r.text.includes("АПЕЛЛЯЦИОННАЯ ЖАЛОБА") && r.text.includes("139.1") && r.text.includes("1. Отменить решение № 1234 от 20.10.2026."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d102.docx", r.a, r.d);
});

t("решение вступило в силу — обычная жалоба, срок год, мягкий стоп", () => {
  const r = run(base, { got_date: "2026-06-01" });
  assert(r.d.lateDecision && r.stop.soft && r.text.includes("ЖАЛОБА") && !r.text.includes("АПЕЛЛЯЦИОННАЯ"));
});

t("возражения на акт — руководителю инспекции, п. 6 ст. 100", () => {
  const r = run(base, { stage: "akt" });
  assert(r.text.startsWith("Кому: руководителю — Инспекция") && r.text.includes("ВОЗРАЖЕНИЯ") && r.text.includes("п. 6 ст. 100"));
});

t("не вернули деньги — проценты по ст. 79", () => {
  const r = run(base, { stage: "delay", reason: "деньги не поступили", args: undefined });
  assert(r.text.includes("ст. 79 НК РФ") && r.text.includes("Начислить проценты"));
});

done();
