// node tests/d23.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d23");
const base = { paternity: "yes", kind: "order", court: "Мировому судье судебного участка № 5 г. Тулы", kids: "Петров Иван Петрович; 01.02.2016\nПетрова Мария Петровна; 05.05.2019", married: "divorced", other_alimony: "no", job: "ООО «Ромашка»",
  p_name: "Петрова Анна Ивановна", p_birth: "1990-01-01", p_place: "г. Тула", p_address: "г. Тула, ул. Мира, д. 3", p_id: "СНИЛС 123-456-789 00", p_phone: "+7 900 000-00-00",
  d_name: "Петров Пётр Петрович", d_birth: "1988-01-01", d_address: "г. Москва, ул. Мира, д. 1" };

t("судебный приказ: 1/3 на двоих, ст. 122 ГПК, без пошлины", () => {
  const r = run(base, {});
  assert(r.text.includes("Взыскатель: Петрова Анна Ивановна") && r.text.includes("Должник: Петров Пётр Петрович") && r.text.includes("Место работы: ООО «Ромашка»"));
  assert(r.text.includes("1/3 (одной трети)") && r.text.includes("ст. 122 ГПК") && r.text.includes("333.36") && r.text.includes("Брак между нами расторгнут"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d23-order.docx", r.a, r.d);
});

t("иск в твёрдой сумме: ст. 83, кратность ПМ, индексация по ст. 117", () => {
  const r = run(base, { kind: "claim", times_pm: 1, region_pm_child: 17000, why_fixed: "Ответчик получает доход наличными" });
  assert.equal(r.d.fixedSum, 17000);
  assert(r.text.includes("ИСКОВОЕ ЗАЯВЛЕНИЕ") && r.text.includes("ст. 83 СК РФ") && r.text.includes("17 000 руб. ежемесячно на каждого ребёнка") && r.text.includes("ст. 117"));
  const r2 = run(base, { kind: "claim", times_pm: 0.5, why_fixed: "x" });
  assert.equal(r2.d.fixedSum, Math.round(18371 * 0.5 * 100) / 100);
  writeDocx("d23-claim.docx", r.a, r.d);
});

t("отцовство не установлено — стоп", () => { assert(run(base, { paternity: "no" }).stop); });

done();
