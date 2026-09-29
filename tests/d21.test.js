// node tests/d21.test.js
const assert = require("assert");
const { U, run, spec, allErrors, t, done, writeDocx } = require("./_load")("d21");
const base = { court: "Мировому судье судебного участка № 123 района Хамовники г. Москвы", marriage_date: "2015-06-15", record: "№ 1234 от 15.06.2015", separate_since: "с марта 2026 года",
  has_kids: "yes", kids: "Петров Иван Петрович; 01.02.2016", kids_live: "plaintiff", kids_dispute: "no", consent: "yes", property: "no", plaintiff_role: "wife",
  p_name: "Петрова Анна Ивановна", p_birth: "1990-01-01", p_place: "г. Москва", p_address: "г. Москва, ул. Ленина, д. 5", p_id: "СНИЛС 123-456-789 00", p_phone: "+7 900 000-00-00",
  d_name: "Петров Пётр Петрович", d_address: "г. Москва, ул. Мира, д. 1" };

t("согласие и ребёнок: ст. 21, 23 СК, спора нет, 5000 ₽, копия ответчику, идентификатор ответчика неизвестен", () => {
  const r = run(base, {});
  assert(r.text.includes("Истец: Петрова Анна Ивановна") && r.text.includes("Идентификатор ответчика истцу неизвестен") && r.text.includes("5000 руб."));
  assert(r.text.includes("Петров Иван Петрович, 01.02.2016 г. р.") && r.text.includes("Ребёнок проживает со мной") && r.text.includes("ст. 23 СК РФ") && r.text.includes("с марта 2026 года"));
  assert(r.text.includes("Расторгнуть брак между истцом (Петрова Анна Ивановна) и ответчиком (Петров Пётр Петрович)") && r.text.includes("направление ответчику копии"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d21.docx", r.a, r.d);
});

t("без согласия — ст. 22 СК; спор о детях — стоп", () => {
  const r = run(base, { consent: "no", reason: "разные взгляды на жизнь" });
  assert(r.text.includes("п. 1 ст. 22") && r.text.includes("разные взгляды на жизнь"));
  assert(run(base, { kids_dispute: "yes" }).stop);
});

t("муж, ребёнку меньше года, жена против — стоп по ст. 17 СК", () => {
  const baby = U.addMonths(U.today(), -5);
  const kids = `Петров Иван Петрович; ${U.fmtDate(baby)}`;
  assert(run(base, { plaintiff_role: "husband", consent: "no", kids }).stop.text.includes("ст. 17"));
  assert(!run(base, { plaintiff_role: "husband", consent: "yes", kids }).stop);
});

done();
