// node tests/d50.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d50");
const base = {
  resolution: "18810177260901234567", decision_date: U.iso(U.addDays(U.today(), -5)), authority: "ЦАФАП в ОДД ГИБДД ГУ МВД России по г. Москве", article: "ч. 2 ст. 12.9 КоАП РФ", amount: 750,
  when: "15.09.2026 в 14:32, г. Москва, Варшавское ш., д. 100", plate: "а123вс777", got_date: U.iso(U.addDays(U.today(), -3)),
  grounds: ["other_driver"], driver: "Сидоров Сидор Сидорович, вписан в полис ОСАГО", proofs: "Копия полиса ОСАГО\nОбъяснение Сидорова С. С.", to: "superior",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("другой водитель: ч. 2 ст. 2.6.1, примечание к ст. 1.5, отменить и прекратить за отсутствием состава", () => {
  const r = run(base, {});
  assert(r.text.includes("через ЦАФАП") && r.text.includes("А123ВС777") && r.text.includes("ч. 2 ст. 2.6.1") && r.text.includes("примечанию к ст. 1.5"));
  assert(r.text.includes("отсутствием в моих действиях состава") && r.text.includes("Приложения:\n1. Копия постановления.\n2. Копия полиса ОСАГО"));
  assert(!r.text.includes("Восстановить срок"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d50.docx", r.a, r.d);
});

t("срок 10 дней с переносом с выходного: получено 23.09.2026 → 03.10 (сб) → 05.10.2026", () => {
  assert.equal(U.fmtDate(run(base, { got_date: "2026-09-23" }).d.deadline), "05.10.2026");
});

t("продажа: ст. 223 ГК; пропуск срока — восстановить по ч. 2 ст. 30.3; в суд", () => {
  const r = run(base, { grounds: ["sold"], sale_date: "2026-09-01", got_date: "2026-08-01", late_reason: "копию увидел(а) только сейчас", to: "court", court_name: "Чертановский районный суд г. Москвы" });
  assert(r.text.startsWith("В Чертановский районный суд") && r.text.includes("п. 1 ст. 223") && r.text.includes("1. Восстановить срок обжалования"));
});

t("скидка 25% — 30 дней со дня постановления", () => {
  const r = run(base, {});
  const g = spec.guidance(r.a, r.d);
  assert(g.some(x => x.title.includes("25%") && x.text.includes("ч. 1.3 ст. 32.2")));
  assert(!spec.guidance(r.a, run(base, { decision_date: "2026-01-01" }).d).some(x => x.title.includes("25%")));
});

done();
