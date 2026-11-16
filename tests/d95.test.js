// node tests/d95.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d95");
const base = {
  mode: "letter", region: "msk", noise: ["music", "repair"], events: [{ date: "2026-11-01", time: "23:30–02:00", what: "громкая музыка" }, { date: "2026-11-08", time: "08:00", what: "перфоратор" }],
  asked: "oral", neighbor_address: "г. Москва, ул. Ленина, д. 5, кв. 50", buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 46", buyer_phone: "+7 900 000-00-00",
};

t("письмо соседу: эпизоды, ЖК, закон Москвы № 42, предупреждение о ст. 3.13 КоАП Москвы", () => {
  const r = run(base, {});
  assert(r.text.includes("ПРЕДУПРЕЖДЕНИЕ") && r.text.includes("— 01.11.2026, 23:30–02:00: громкая музыка;") && r.text.includes("№ 42") && r.text.includes("ст. 3.13"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d95.docx", r.a, r.d);
});

t("заявление участковому: КУСП, талон, ст. 28.1, свидетели", () => {
  const r = run(base, { mode: "police", police_unit: "Отдел МВД России по району Хамовники г. Москвы", witnesses: "Сидоров И. И." });
  assert(r.text.startsWith("В Отдел МВД") && r.text.includes("ст. 28.1 КоАП РФ") && r.text.includes("талон-уведомление") && r.text.includes("подтвердить: Сидоров И. И."));
  assert(r.text.includes("Я неоднократно устно просил(а)"));
  assert.deepEqual(allErrors(r.a), []);
});

t("другой регион без закона — общая ссылка, без статьи КоАП", () => {
  const r = run(base, { region: "other", mode: "police", police_unit: "ОМВД" });
  assert(r.text.includes("закон субъекта Российской Федерации об обеспечении тишины") && !r.text.includes("образуют состав"));
});

done();
